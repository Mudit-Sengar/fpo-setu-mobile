import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useApp } from "../lib/app-state";

/**
 * Speech-to-text for Krishi Bandhu, on expo-speech-recognition.
 *
 * WHY NOT @react-native-voice/voice
 * ----------------------------------
 * That package ships no TurboModule/codegen config — it predates the New
 * Architecture, which this app has enabled (newArchEnabled=true). Reports from
 * other New-Architecture Expo apps describe it failing silently there (no
 * error, mic just does nothing), which would be worse than a surfaced error.
 * expo-speech-recognition is TurboModule-based and used here for that reason.
 *
 * WHY THIS IS NETWORK-FIRST
 * -------------------------
 * Android routes SpeechRecognizer to a recognition *service*. On Android 13+
 * the system prefers the ON-DEVICE recogniser (com.google.android.as), which
 * only works for languages the user has explicitly downloaded — missing pack
 * => ERROR_LANGUAGE_NOT_SUPPORTED. We never want to ask a farmer to install a
 * language pack, so every attempt sets:
 *   - requiresOnDeviceRecognition: false
 *   - androidIntentOptions.EXTRA_PREFER_OFFLINE: false
 * which together hint the OS toward network recognition without requiring a
 * downloaded pack.
 *
 * WHAT CHANGED HERE (previously forced a service, which broke instead)
 * ----------------------------------------------------------------------
 * An earlier version of this hook *forced* androidRecognitionServicePackage to
 * "com.google.android.googlequicksearchbox" on every attempt. That is the
 * right network-capable service on Android <= 12, but is not guaranteed to be
 * correct on Android 13+ or on OEM skins with a different default assistant —
 * forcing the wrong component can itself surface as ERROR_NETWORK (a bind
 * failure to a service that cannot actually reach the network), which is
 * indistinguishable to us from a real connectivity problem.
 *
 * The fix: attempt 0 no longer forces any service — it lets the OS use
 * whatever the user's actual default recogniser is, which is the
 * configuration most likely to already work on their phone. Explicit
 * alternate services are only tried as a fallback, and only for errors that
 * indicate a service/language mismatch (not for genuine "network" errors,
 * where retrying a different service wastes time without fixing anything).
 *
 * The native module is lazily required and failure-tolerant, so Expo Go
 * (where it does not exist) degrades to typed input instead of crashing.
 */

export type VoiceStatus = "idle" | "listening" | "processing";
export type PermissionOutcome = "granted" | "denied" | "blocked" | "unavailable";

const LOCALE: Record<string, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };

/** The on-device-only recogniser — the one that needs a downloaded language pack. */
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

/**
 * Alternate services to try only as a fallback, after the unforced system
 * default has already failed. Deliberately excludes the on-device-only
 * recogniser, and deliberately does NOT guess a "correct" service up front —
 * that guess is exactly what broke this before.
 */
function pickFallbackServices(mod: SpeechModule): string[] {
  if (Platform.OS !== "android") return [];
  try {
    const services = mod.ExpoSpeechRecognitionModule.getSpeechRecognitionServices() ?? [];
    return services.filter((s) => s !== ON_DEVICE_SERVICE);
  } catch {
    return [];
  }
}

interface Attempt {
  locale?: string;
  service?: string;
}

/**
 * Ordered attempts. Every attempt forces EXTRA_PREFER_OFFLINE=false, so none
 * of them require a downloaded language pack. The first two never force a
 * service — that is the configuration most likely to match what already
 * works on the user's phone. Explicit services are last-resort only.
 */
function buildAttempts(locale: string | undefined, fallbackServices: string[]): Attempt[] {
  const list: Attempt[] = [
    { locale },   // system default service, negotiated locale
    {},           // system default service, recogniser's own default locale
  ];
  for (const service of fallbackServices) {
    list.push({ locale, service });
    list.push({ service });
  }
  const seen = new Set<string>();
  return list.filter((a) => {
    const k = `${a.locale ?? ""}|${a.service ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Errors worth trying the next configuration for. Deliberately excludes
 * "network"/"network-timeout": if the device truly has no connectivity,
 * cycling through services would just stack up several more timeouts without
 * fixing anything.
 */
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
    const [locale, fallbackServices] = [await pickSupportedLocale(mod, preferred), pickFallbackServices(mod)];
    attemptsRef.current = buildAttempts(locale, fallbackServices);
    runAttemptRef.current(0);
  }, [ensurePermission, lang, stop]);

  const clearError = useCallback(() => setError(null), []);

  return { status, available, partial, error, start, stop, clearError };
}

/**
 * Farmer-facing messages. Deliberately never surfaces raw Android error codes.
 * Language-pack errors should be rare now: every attempt forces cloud
 * recognition, and a language/service mismatch is retried automatically
 * before this message is ever shown.
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
