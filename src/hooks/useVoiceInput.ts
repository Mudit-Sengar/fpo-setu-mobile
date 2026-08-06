import { useCallback, useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import {
  start as startRecognition,
  stop as stopRecognition,
  requestPermissions,
  isAvailable,
  addSpeechResultListener,
  addSpeechErrorListener,
  addSpeechEndListener,
  SpeechErrorCode,
  type SpeechResult,
  type SpeechError,
} from "@dbkable/react-native-speech-to-text";
import { useApp } from "../lib/app-state";

/**
 * Speech-to-text for Krishi Bandhu, on @dbkable/react-native-speech-to-text —
 * a TurboModule-based package, required since this app runs on the New
 * Architecture with no legacy-bridge fallback (newArchEnabled=true, RN 0.86).
 *
 * KNOWN REGRESSION VS. THE PREVIOUS expo-speech-recognition IMPLEMENTATION
 * --------------------------------------------------------------------------
 * The previous hook negotiated a supported locale and, on failure, retried
 * against alternate Android recognition services (see git history: "negotiate
 * a supported speech locale", "stop force-selecting a recognition service") —
 * real fixes for real on-device failures. This package's API is start({
 * language }) / stop() / requestPermissions() / isAvailable() plus result/
 * error/end listeners — it does not expose service enumeration or per-attempt
 * service targeting, so that negotiation/retry logic cannot be ported as-is.
 * This is a deliberate, documented trade-off (try the maintained npm package
 * first); if voice input misbehaves on real devices the way the old
 * force-a-service bug did, the fix is a small custom Android TurboModule
 * wrapping android.speech.SpeechRecognizer directly, which can reintroduce
 * that negotiation using the exact same manifest <queries> already declared
 * for it.
 */

export type VoiceStatus = "idle" | "listening" | "processing";

const LOCALE: Record<string, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };

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
    void isAvailable()
      .then((v) => { if (!cancelled) setAvailable(v); })
      .catch(() => { if (!cancelled) setAvailable(false); });
    return () => { cancelled = true; };
  }, []);

  // ---- native events ----------------------------------------------------
  useEffect(() => {
    const resultSub = addSpeechResultListener((result: SpeechResult) => {
      if (result.isFinal) {
        setPartial("");
        setStatus("processing");
        const text = result.transcript.trim();
        if (text.length > 0) onResultRef.current(text);
        setTimeout(() => setStatus("idle"), 250);
      } else {
        setPartial(result.transcript);
      }
    });

    const errorSub = addSpeechErrorListener((e: SpeechError) => {
      setPartial("");
      setStatus("idle");
      setError(describeError(e.code));
    });

    const endSub = addSpeechEndListener(() => {
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
    void stopRecognition().catch(() => { /* not running */ });
    setPartial("");
    setStatus("idle");
  }, []);

  // ---- lifecycle ----------------------------------------------------------
  useEffect(() => {
    if (!isFocused && statusRef.current !== "idle") stop();
  }, [isFocused, stop]);

  useEffect(() => () => {
    void stopRecognition().catch(() => { /* not running */ });
  }, []);

  const start = useCallback(async () => {
    setError(null);

    if (statusRef.current === "listening") { stop(); return; }

    try {
      const canUse = await isAvailable();
      setAvailable(canUse);
      if (!canUse) {
        setError("Voice services aren't available on this device — please type.");
        return;
      }

      const granted = await requestPermissions({
        title: "Microphone Permission",
        message: "FPO Setu needs microphone access for voice input.",
        buttonPositive: "Allow",
      });
      if (!granted) {
        setError("Microphone permission is needed for voice. You can still type.");
        return;
      }

      setStatus("listening");
      await startRecognition({ language: LOCALE[lang] ?? "en-IN" });
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
    case SpeechErrorCode.REQUEST_FAILED:
    case SpeechErrorCode.CLIENT_ERROR:
    case SpeechErrorCode.SERVER_ERROR:
    case SpeechErrorCode.UNKNOWN_ERROR:
    default:
      return "Voice didn't work that time — please try again or type.";
  }
}
