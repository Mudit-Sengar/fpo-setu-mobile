import { useCallback, useState } from "react";
import * as Speech from "expo-speech";
import { useApp } from "../lib/app-state";
import { toast } from "../components/ui/Toast";

/**
 * Unified speech hook replacing the web app's THREE separate ad-hoc Web Speech API
 * implementations (AssistantWidget.tsx, farmer.index.tsx, fpo-sections.tsx `speak()`).
 *
 * Text-to-speech  -> expo-speech (full parity with `window.speechSynthesis`).
 * Speech-to-text  -> NOT AVAILABLE. `window.SpeechRecognition` has no built-in Expo
 *   equivalent. Text input works everywhere; the mic button reports that voice
 *   dictation needs a native module. To enable it later, install
 *   `expo-speech-recognition` and implement `startListening` below — this hook is
 *   the single integration point, no screen code needs to change.
 */

const LOCALE: Record<string, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };

export function useSpeech() {
  const { lang } = useApp();
  const [listening] = useState(false);

  const speak = useCallback(
    (text: string) => {
      Speech.stop();
      Speech.speak(text, { language: LOCALE[lang] ?? "en-IN", rate: 0.95 });
    },
    [lang],
  );

  const stopSpeaking = useCallback(() => { Speech.stop(); }, []);

  const speechRecognitionAvailable = false;

  const startListening = useCallback(() => {
    toast.message("Voice input needs a native speech module — please type your question.");
  }, []);

  const stopListening = useCallback(() => {}, []);

  return { speak, stopSpeaking, listening, startListening, stopListening, speechRecognitionAvailable };
}
