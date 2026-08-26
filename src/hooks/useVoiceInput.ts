import { useCallback, useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { DeviceEventEmitter, PermissionsAndroid, Platform } from "react-native";
import NativeVoiceInput from "../native/NativeVoiceInput";
import { useApp } from "../lib/app-state";

/**
 * Speech-to-text for Krishi Bandhu, on the app's own NativeVoiceInput TurboModule
 * (see src/native/NativeVoiceInput.ts and
 * android/app/src/main/java/com/fposetu/mobile/VoiceInputModule.kt) — hand-written
 * because the previously-used @dbkable/react-native-speech-to-text package's native
 * module never actually implemented the TurboModule interface it registered as, so it
 * always threw on import under this app's New Architecture (newArchEnabled=true, RN
 * 0.86, no legacy-bridge fallback) before the mic could ever be tapped.
 *
 * The native module launches Android's speech recognizer as its own foreground
 * dialog Activity rather than binding the headless SpeechRecognizer service class —
 * see VoiceInputModule.kt's header comment for why (in short: the headless approach
 * failed with MICROPHONE_UNAVAILABLE on a real OEM device despite RECORD_AUDIO being
 * granted, due to that device's power management not treating a bound background
 * service as foreground enough). One consequence of the fix: there are no live
 * partial results while speaking — `onSpeechResult` only ever fires once, final.
 */

export type VoiceStatus = "idle" | "listening" | "processing";

const LOCALE: Record<string, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };

export enum SpeechErrorCode {
  PERMISSION_DENIED = "PERMISSION_DENIED",
  NOT_AVAILABLE = "NOT_AVAILABLE",
  START_FAILED = "START_FAILED",
  STOP_FAILED = "STOP_FAILED",
  AUDIO_ERROR = "AUDIO_ERROR",
  CLIENT_ERROR = "CLIENT_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  NETWORK_TIMEOUT = "NETWORK_TIMEOUT",
  RECOGNIZER_BUSY = "RECOGNIZER_BUSY",
  SERVER_ERROR = "SERVER_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

interface SpeechResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

interface SpeechError {
  code: SpeechErrorCode | string;
  message: string;
}

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

  // ---- availability ---------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    void NativeVoiceInput.isAvailable()
      .then((v) => { if (!cancelled) setAvailable(v); })
      .catch(() => { if (!cancelled) setAvailable(false); });
    return () => { cancelled = true; };
  }, []);

  // ---- native events ----------------------------------------------------
  useEffect(() => {
    const resultSub = DeviceEventEmitter.addListener("onSpeechResult", (result: SpeechResult) => {
      setPartial("");
      setStatus("processing");
      const text = result.transcript.trim();
      if (text.length > 0) onResultRef.current(text);
      setTimeout(() => setStatus("idle"), 250);
    });

    const errorSub = DeviceEventEmitter.addListener("onSpeechError", (e: SpeechError) => {
      setPartial("");
      setStatus("idle");
      setError(describeError(e.code));
    });

    const endSub = DeviceEventEmitter.addListener("onSpeechEnd", () => {
      setPartial("");
      if (statusRef.current === "listening") setStatus("idle");
    });

    return () => {
      resultSub.remove();
      errorSub.remove();
      endSub.remove();
    };
  }, []);

  const stop = useCallback(() => {
    void NativeVoiceInput.stop().catch(() => { /* not running */ });
    setPartial("");
    setStatus("idle");
  }, []);

  // ---- lifecycle ----------------------------------------------------------
  useEffect(() => {
    if (!isFocused && statusRef.current !== "idle") stop();
  }, [isFocused, stop]);

  useEffect(() => () => {
    void NativeVoiceInput.stop().catch(() => { /* not running */ });
  }, []);

  const start = useCallback(async () => {
    setError(null);

    if (statusRef.current === "listening") { stop(); return; }

    try {
      const canUse = await NativeVoiceInput.isAvailable();
      setAvailable(canUse);
      if (!canUse) {
        setError("Voice services aren't available on this device — please type.");
        return;
      }

      const granted = Platform.OS !== "android" || (await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: "Microphone Permission",
          message: "FPO Setu needs microphone access for voice input.",
          buttonPositive: "Allow",
        },
      )) === PermissionsAndroid.RESULTS.GRANTED;
      if (!granted) {
        setError("Microphone permission is needed for voice. You can still type.");
        return;
      }

      setStatus("listening");
      await NativeVoiceInput.start(LOCALE[lang] ?? "en-IN");
    } catch {
      setStatus("idle");
      setError("Couldn't start voice input. Please type your request.");
    }
  }, [lang, stop]);

  const clearError = useCallback(() => setError(null), []);

  return { status, available, partial, error, start, stop, clearError };
}

/** Farmer-facing messages. Deliberately never surfaces raw Android error codes. */
function describeError(code: SpeechErrorCode | string): string | null {
  switch (code) {
    case SpeechErrorCode.PERMISSION_DENIED:
      return "Microphone access was refused. You can still type.";
    case SpeechErrorCode.NOT_AVAILABLE:
      return "Voice isn't available on this device right now — please type instead.";
    case SpeechErrorCode.NETWORK_ERROR:
    case SpeechErrorCode.NETWORK_TIMEOUT:
      return "Voice needs an internet connection. Please check your network or type instead.";
    case SpeechErrorCode.AUDIO_ERROR:
      return "Microphone is busy or unavailable. Please type instead.";
    case SpeechErrorCode.RECOGNIZER_BUSY:
      return "Voice is still starting up — tap the mic again in a moment.";
    case SpeechErrorCode.START_FAILED:
    case SpeechErrorCode.STOP_FAILED:
    case SpeechErrorCode.CLIENT_ERROR:
    case SpeechErrorCode.SERVER_ERROR:
    case SpeechErrorCode.UNKNOWN_ERROR:
    default:
      return "Voice didn't work that time — please try again or type.";
  }
}
