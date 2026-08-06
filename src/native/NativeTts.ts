import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Codegen spec for the app's own text-to-speech TurboModule.
 *
 * WHY A CUSTOM MODULE INSTEAD OF AN npm PACKAGE
 * ---------------------------------------------
 * This app runs on the New Architecture (newArchEnabled=true, RN 0.86), which has
 * no legacy-bridge interop layer — a native module must be a real TurboModule or it
 * does not work at all. The obvious candidate, `react-native-tts`, is a dead end on
 * three counts: no `codegenConfig` (not a TurboModule), `ReactContextBaseJavaModule`
 * (old bridge), and a bundled Gradle file still calling `jcenter()` with AGP 1.3.1,
 * which fails to even configure under Gradle 9.
 *
 * So this is a thin wrapper over Android's built-in android.speech.tts.TextToSpeech
 * — see android/app/src/main/java/com/fposetu/mobile/TtsModule.kt.
 */
export interface Spec extends TurboModule {
  /**
   * Speak `text`. `language` is a BCP-47 tag (e.g. "en-IN", "hi-IN", "mr-IN");
   * falls back to the device default if that language isn't installed.
   * `rate` is 1.0 for normal speed.
   */
  speak(text: string, language: string, rate: number): void;
  /** Stop any in-progress utterance and flush the queue. */
  stop(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeTts');
