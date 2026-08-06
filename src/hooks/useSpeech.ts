import { useCallback, useState } from "react";
import NativeTts from "../native/NativeTts";
import { useApp } from "../lib/app-state";
import { toast } from "../components/ui/Toast";

/**
 * Unified speech hook replacing the web app's THREE separate ad-hoc Web Speech API
 * implementations (AssistantWidget.tsx, farmer.index.tsx, fpo-sections.tsx `speak()`).
 *
 * Text-to-speech  -> the app's own NativeTts TurboModule (see src/native/NativeTts.ts
 *   and android/app/src/main/java/com/fposetu/mobile/TtsModule.kt). Hand-written because
 *   `react-native-tts` is old-bridge-only and won't build or run on RN 0.86's New
 *   Architecture — details in the spec file's header comment.
 * Speech-to-text  -> handled separately by useVoiceInput.ts (Krishi Bandhu's mic
 *   button on Farmer Home). This hook's own startListening/stopListening remain a
 *   stub for the assistant widget's mic — that was already the case before this
 *   migration (the two hooks were never wired together), not a new regression.
 */

const LOCALE: Record<string, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };

export function useSpeech() {
  const { lang } = useApp();
  const [listening] = useState(false);

  const speak = useCallback(
    (text: string) => {
      NativeTts.speak(text, LOCALE[lang] ?? "en-IN", 0.95);
    },
    [lang],
  );

  const stopSpeaking = useCallback(() => { NativeTts.stop(); }, []);

  const speechRecognitionAvailable = false;

  const startListening = useCallback(() => {
    toast.message("Voice input needs a native speech module — please type your question.");
  }, []);

  const stopListening = useCallback(() => {}, []);

  return { speak, stopSpeaking, listening, startListening, stopListening, speechRecognitionAvailable };
}
