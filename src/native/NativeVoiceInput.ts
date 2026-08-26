import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Codegen spec for the app's own speech-to-text TurboModule.
 *
 * WHY A CUSTOM MODULE INSTEAD OF THE `@dbkable/react-native-speech-to-text` PACKAGE
 * -----------------------------------------------------------------------------------
 * That package's JS side calls `TurboModuleRegistry.getEnforcing('ReactNativeSpeechToText')`,
 * but its Kotlin module (`ReactNativeSpeechToTextModule`) extends plain
 * `ReactContextBaseJavaModule` instead of the codegen'd `NativeReactNativeSpeechToTextSpec`
 * abstract class, and its package explicitly registers `isTurboModule = false`. On this
 * app's New Architecture (newArchEnabled=true, RN 0.86, no legacy-bridge interop) that
 * module can never satisfy `getEnforcing` — it throws at import time, before the mic is
 * ever tapped. Same dead end as `react-native-tts` (see src/native/NativeTts.ts), so the
 * fix follows the same pattern: a thin wrapper over Android's built-in speech
 * recognition — see android/app/src/main/java/com/fposetu/mobile/VoiceInputModule.kt.
 *
 * That wrapper launches RecognizerIntent.ACTION_RECOGNIZE_SPEECH as its own foreground
 * Activity (startActivityForResult) rather than binding the headless SpeechRecognizer
 * service class directly — the latter failed consistently on a real OEM device with
 * "MICROPHONE_UNAVAILABLE" even with RECORD_AUDIO granted, because the recognizer then
 * runs as a background-bound service whose foreground-ness that OEM's power management
 * doesn't reliably honor for the RECORD_AUDIO AppOps check. See VoiceInputModule.kt's
 * header comment for the full logcat-backed explanation. One consequence: there are no
 * live partial results while speaking (Google's own dialog shows its own instead), so
 * `onSpeechResult` only ever fires once, with `isFinal: true`.
 *
 * Results, errors and end-of-speech are pushed as plain DeviceEventEmitter events
 * ("onSpeechResult" / "onSpeechError" / "onSpeechEnd") rather than through the Spec,
 * since RN's event emitter interop works the same in both architectures and keeps
 * this interface small.
 */
export interface Spec extends TurboModule {
  /** Starts listening. `language` is a BCP-47 tag (e.g. "en-IN", "hi-IN", "mr-IN"). */
  start(language: string): Promise<void>;
  /** Dismisses the recognizer dialog if it's still open; suppresses its result. */
  stop(): Promise<void>;
  /** Whether a speech recognition app is available on this device right now. */
  isAvailable(): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeVoiceInput');
