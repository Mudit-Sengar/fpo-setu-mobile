import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useApp } from "../lib/app-state";

/**
 * Speech-to-text for Krishi Bandhu, built on expo-speech-recognition.
 *
 * IMPORTANT: this is a native module, so it does not exist in Expo Go. The
 * import is therefore lazy and failure-tolerant — when the native side is
 * missing, `available` stays false, no listeners are attached, and the UI
 * silently falls back to typed input instead of crashing.
 *
 * Status surfaced to the UI:
 *   idle       — ready, nothing happening
 *   listening  — mic open, capturing speech
 *   processing — final transcript captured, intent being resolved
 *
 * Permission outcomes are distinguished so the UI can react correctly:
 *   granted | denied (can ask again) | blocked (needs Settings) | unavailable
 */

export type VoiceStatus = "idle" | "listening" | "processing";
export type PermissionOutcome = "granted" | "denied" | "blocked" | "unavailable";

const LOCALE: Record<string, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };

type SpeechModule = typeof import("expo-speech-recognition");
let cachedModule: SpeechModule | null = null;
let moduleResolved = false;

/** Resolve the native module once; null when it isn't in the binary (Expo Go). */
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

/**
 * The module's public typings expose `useSpeechRecognitionEvent` rather than
 * `addListener`, but the underlying native module is an EventEmitter and
 * `addListener` exists at runtime. We attach imperatively (not via the hook) so
 * the whole integration can stay behind the lazy require above.
 */
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

export interface UseVoiceInput {
  status: VoiceStatus;
  /** False in Expo Go, or when the device has no speech recogniser installed. */
  available: boolean;
  /** Live partial transcript while listening; "" otherwise. */
  partial: string;
  /** User-facing error message, or null. */
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

  // Latest callback without re-subscribing native listeners.
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const statusRef = useRef<VoiceStatus>("idle");
  useEffect(() => { statusRef.current = status; }, [status]);

  // ---- availability -------------------------------------------------------
  useEffect(() => {
    const mod = getSpeechModule();
    if (!mod) { setAvailable(false); return; }
    try {
      const recognisable = mod.ExpoSpeechRecognitionModule.isRecognitionAvailable();
      // Android 11+: with no matching <queries> entry, or no Google app, the
      // services list is empty and starting would fail.
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
          // Short, perceivable processing state before returning to idle.
          setTimeout(() => setStatus("idle"), 250);
        } else {
          setPartial(transcript);
        }
      }),
      addListener(mod, "error", (e) => {
        setPartial("");
        setStatus("idle");
        setError(describeError(e?.error));
      }),
      addListener(mod, "nomatch", () => {
        setPartial("");
        setStatus("idle");
        setError("Didn't catch that — tap the mic and try again.");
      }),
      addListener(mod, "end", () => {
        setPartial("");
        // Only reset when no final result arrived (that path sets "processing").
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

  // ---- stop cleanly when leaving the screen -------------------------------
  useEffect(() => {
    if (!isFocused && statusRef.current !== "idle") stop();
  }, [isFocused, stop]);

  useEffect(() => () => {
    // Unmount: abort rather than stop, so no trailing result fires into a dead screen.
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
      // Already permanently denied — asking again shows nothing.
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
      setError("Voice needs the full app build (not Expo Go) — please type instead.");
      return;
    }

    // Tap while listening = stop.
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

    try {
      setStatus("listening");
      mod.ExpoSpeechRecognitionModule.start({
        lang: LOCALE[lang] ?? "en-IN",
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: false,
        addsPunctuation: false,
      });
    } catch {
      setStatus("idle");
      setError("Couldn't start voice input. Please type your request.");
    }
  }, [ensurePermission, lang, stop]);

  const clearError = useCallback(() => setError(null), []);

  return { status, available, partial, error, start, stop, clearError };
}

/**
 * Map recogniser error codes onto something a farmer can act on.
 * Returns null for user-initiated cancellation, which isn't an error.
 */
function describeError(code?: string): string | null {
  switch (code) {
    case "aborted":
      return null;
    case "no-speech":
      return "Didn't catch that — tap the mic and try again.";
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was refused. You can still type.";
    case "network":
    case "network-timeout":
      return "Voice needs a network connection. Please type instead.";
    case "audio-capture":
      return "Microphone unavailable. Please type instead.";
    case "language-not-supported":
      return "That language isn't supported for voice here — please type.";
    default:
      return "Voice input failed — please type your request.";
  }
}
