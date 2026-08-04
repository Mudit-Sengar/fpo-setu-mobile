import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useApp } from "../lib/app-state";

/**
 * Speech-to-text for Krishi Bandhu, on expo-speech-recognition.
 *
 * WHY THIS IS NETWORK-FIRST
 * -------------------------
 * Android routes SpeechRecognizer to a recognition *service*. On Android 13+ the
 * system prefers the ON-DEVICE recogniser (com.google.android.as), which only
 * works for languages the user has explicitly downloaded. If that pack is
 * missing it fails with ERROR_LANGUAGE_NOT_SUPPORTED — which is exactly what we
 * hit, and it is not something we should ask farmers to fix in Settings.
 *
 * The fix is to force cloud recognition:
 *   - androidIntentOptions.EXTRA_PREFER_OFFLINE = false  (never require a pack)
 *   - target the network-capable Google service explicitly, not the on-device one
 *
 * Cloud recognition needs no downloaded language pack and supports far more
 * languages, including hi-IN and mr-IN. The only user-facing requirement is
 * microphone permission, plus a network connection.
 *
 * We then try a small ladder of attempts (see buildAttempts) so a single
 * unsupported combination never dead-ends the farmer.
 *
 * The native module is lazily required and failure-tolerant, so Expo Go (where
 * it does not exist) degrades to typed input instead of crashing.
 */

export type VoiceStatus = "idle" | "listening" | "processing";
export type PermissionOutcome = "granted" | "denied" | "blocked" | "unavailable";

const LOCALE: Record<string, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };

/** Google's network-capable recogniser. `com.google.android.as` is on-device only. */
const NETWORK_SERVICE = "com.google.android.googlequicksearchbox";
const ON_DEVICE_SERVICE = "com.google.android.as";

type SpeechModule = typeof import("expo-speech-recognition");
let cachedModule: SpeechModule | null = null;
let moduleResolved = false;

function getSpeechModule(): SpeechModule | null {
  if (!moduleResolved) {
    moduleResolved = true;
    try {
      cachedModule = require("expo-speech-recognition") as SpeechModule;
    } catch {
      cachedModule = null;
    }
  }
  return cachedModule;
}

type Subscription = { remove: () => void };
function addListener(mod: SpeechModule, event: string, cb: (e: any) => void): Subscription | null {
  const emitter = mod.ExpoSpeechRecognitionModule as unknown as {
    addListener?: (e: string, cb: (ev: any) => void) => Subscription;
  };
  try {
    return emitter.addListener?.(event, cb) ?? null;
  } catch {
    return null;
  }
}

const normaliseTag = (s: string) => s.replace(/_/g, "-").toLowerCase();

/** Pick a locale the recogniser lists, else undefined (recogniser default). */
async function pickSupportedLocale(mod: SpeechModule, preferred: string): Promise<string | undefined> {
  try {
    const res = await mod.ExpoSpeechRecognitionModule.getSupportedLocales({});
    const all = [...(res?.installedLocales ?? []), ...(res?.locales ?? [])];
    // Empty on Android <= 12 — not a signal that nothing is supported.
    if (all.length === 0) return undefined;

    const want = normaliseTag(preferred);
    const exact = all.find((l) => normaliseTag(l) === want);
    if (exact) return exact;

    const prefix = want.split("-")[0];
    const sameLanguage = all.find((l) => normaliseTag(l).startsWith(`${prefix}-`));
    if (sameLanguage) return sameLanguage;

    return undefined;
  } catch {
    return undefined;
  }
}

/** Which recognition service to ask for; undefined = system default. */
function pickService(mod: SpeechModule): string | undefined {
  if (Platform.OS !== "android") return undefined;
  try {
    const services = mod.ExpoSpeechRecognitionModule.getSpeechRecognitionServices() ?? [];
    if (services.includes(NETWORK_SERVICE)) return NETWORK_SERVICE;
    const fallback = mod.ExpoSpeechRecognitionModule.getDefaultRecognitionService?.()?.packageName;
    // Never deliberately choose the on-device-only service: that is the thing
    // that requires a downloaded language pack.
    if (fallback && fallback !== ON_DEVICE_SERVICE) return fallback;
    return undefined;
  } catch {
    return undefined;
  }
}

interface Attempt {
  locale?: string;
  service?: string;
}

/**
 * Ordered fallbacks. Every attempt forces EXTRA_PREFER_OFFLINE=false, so none of
 * them require a downloaded language pack.
 */
function buildAttempts(locale: string | undefined, service: string | undefined): Attempt[] {
  const list: Attempt[] = [];
  if (service && locale) list.push({ locale, service });
  if (service) list.push({ service });
  if (locale) list.push({ locale });
  list.push({});                       // system default, recogniser picks language
  // De-duplicate structurally identical attempts.
  const seen = new Set<string>();
  return list.filter((a) => {
    const k = `${a.locale ?? ""}|${a.service ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Errors worth trying the next configuration for. */
const RETRYABLE = new Set(["language-not-supported", "service-not-allowed", "client"]);

export interface UseVoiceInput {
  status: VoiceStatus;
  available: boolean;
  partial: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  clearError: () => void;
}

export function useVoiceInput(onResult: (transcript: string) => void): UseVoiceInput {
  const { lang } = useApp();
  const isFocused = useIsFocused();
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [available, setAvailable] = useState(false);
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const statusRef = useRef<VoiceStatus>("idle");
  useEffect(() => { statusRef.current = status; }, [status]);

  const attemptsRef = useRef<Attempt[]>([]);
  const attemptIdxRef = useRef(0);

  /** Run one attempt. Held in a ref so the once-mounted error listener can advance. */
  const runAttemptRef = useRef<(index: number) => void>(() => {});
  runAttemptRef.current = (index: number) => {
    const mod = getSpeechModule();
    if (!mod) return;
    const attempt = attemptsRef.current[index];
    if (!attempt) {
      setStatus("idle");
      setError("Voice isn't working on this device right now — please type instead.");
      return;
    }
    attemptIdxRef.current = index;
    try {
      setStatus("listening");
      mod.ExpoSpeechRecognitionModule.start({
        ...(attempt.locale ? { lang: attempt.locale } : {}),
        ...(attempt.service ? { androidRecognitionServicePackage: attempt.service } : {}),
        interimResults: true,
        continuous: false,
        // Cloud recognition: no downloaded language pack required.
        requiresOnDeviceRecognition: false,
        addsPunctuation: false,
        androidIntentOptions: {
          EXTRA_PREFER_OFFLINE: false,
          EXTRA_LANGUAGE_MODEL: "free_form",
        },
      });
    } catch {
      setStatus("idle");
      setError("Couldn't start voice input. Please type your request.");
    }
  };

  // ---- availability -------------------------------------------------------
  useEffect(() => {
    const mod = getSpeechModule();
    if (!mod) { setAvailable(false); return; }
    try {
      const recognisable = mod.ExpoSpeechRecognitionModule.isRecognitionAvailable();
      const services = Platform.OS === "android"
        ? mod.ExpoSpeechRecognitionModule.getSpeechRecognitionServices()
        : ["ios"];
      setAvailable(Boolean(recognisable) && (services?.length ?? 0) > 0);
    } catch {
      setAvailable(false);
    }
  }, []);

  // ---- native events ------------------------------------------------------
  useEffect(() => {
    const mod = getSpeechModule();
    if (!mod) return;

    const subs: (Subscription | null)[] = [
      addListener(mod, "result", (e) => {
        const transcript: string = e?.results?.[0]?.transcript ?? "";
        if (e?.isFinal) {
          setPartial("");
          setStatus("processing");
          const text = transcript.trim();
          if (text.length > 0) onResultRef.current(text);
          setTimeout(() => setStatus("idle"), 250);
        } else {
          setPartial(transcript);
        }
      }),
      addListener(mod, "error", (e) => {
        setPartial("");
        const code: string | undefined = e?.error;

        // Try the next configuration before giving up on the farmer.
        if (code && RETRYABLE.has(code) && attemptIdxRef.current + 1 < attemptsRef.current.length) {
          runAttemptRef.current(attemptIdxRef.current + 1);
          return;
        }
        setStatus("idle");
        setError(describeError(code));
      }),
      addListener(mod, "nomatch", () => {
        setPartial("");
        setStatus("idle");
        setError("Didn't catch that — tap the mic and try again.");
      }),
      addListener(mod, "end", () => {
        setPartial("");
        if (statusRef.current === "listening") setStatus("idle");
      }),
    ];

    return () => {
      subs.forEach((s) => { try { s?.remove(); } catch { /* already detached */ } });
    };
  }, []);

  const stop = useCallback(() => {
    const mod = getSpeechModule();
    try { mod?.ExpoSpeechRecognitionModule.stop(); } catch { /* not running */ }
    setPartial("");
    setStatus("idle");
  }, []);

  // ---- lifecycle ----------------------------------------------------------
  useEffect(() => {
    if (!isFocused && statusRef.current !== "idle") stop();
  }, [isFocused, stop]);

  useEffect(() => () => {
    const mod = getSpeechModule();
    try { mod?.ExpoSpeechRecognitionModule.abort(); } catch { /* not running */ }
  }, []);

  // ---- permission ---------------------------------------------------------
  const ensurePermission = useCallback(async (): Promise<PermissionOutcome> => {
    const mod = getSpeechModule();
    if (!mod) return "unavailable";
    try {
      const current = await mod.ExpoSpeechRecognitionModule.getPermissionsAsync();
      if (current.granted) return "granted";
      if (!current.canAskAgain) return "blocked";
      const asked = await mod.ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (asked.granted) return "granted";
      return asked.canAskAgain ? "denied" : "blocked";
    } catch {
      return "unavailable";
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);

    const mod = getSpeechModule();
    if (!mod) {
      setError("Voice isn't available in this build — please type instead.");
      return;
    }

    if (statusRef.current === "listening") { stop(); return; }

    const outcome = await ensurePermission();
    if (outcome === "blocked") {
      setError("Microphone access is blocked. Enable it in Settings to use voice.");
      try { await Linking.openSettings(); } catch { /* can't open settings */ }
      return;
    }
    if (outcome === "denied") {
      setError("Microphone permission is needed for voice. You can still type.");
      return;
    }
    if (outcome === "unavailable") {
      setError("Voice services aren't available on this device — please type.");
      return;
    }

    const preferred = LOCALE[lang] ?? "en-IN";
    const [locale, service] = [await pickSupportedLocale(mod, preferred), pickService(mod)];
    attemptsRef.current = buildAttempts(locale, service);
    runAttemptRef.current(0);
  }, [ensurePermission, lang, stop]);

  const clearError = useCallback(() => setError(null), []);

  return { status, available, partial, error, start, stop, clearError };
}

/**
 * Farmer-facing messages. Deliberately never surfaces raw Android error codes.
 * Language-pack errors are absent by design: every attempt forces cloud
 * recognition, so a missing on-device pack can no longer be the cause.
 */
function describeError(code?: string): string | null {
  switch (code) {
    case "aborted":
      return null;
    case "no-speech":
      return "Didn't catch that — tap the mic and try again.";
    case "not-allowed":
      return "Microphone access was refused. You can still type.";
    case "network":
    case "network-timeout":
      return "Voice needs an internet connection. Please check your network or type instead.";
    case "audio-capture":
      return "Microphone is busy or unavailable. Please type instead.";
    case "busy":
      return "Voice is still starting up — tap the mic again in a moment.";
    default:
      return "Voice didn't work that time — please try again or type.";
  }
}
