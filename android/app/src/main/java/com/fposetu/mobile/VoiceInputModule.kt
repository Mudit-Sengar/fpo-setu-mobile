package com.fposetu.mobile

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.speech.RecognizerIntent
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Speech-to-text TurboModule backing Krishi Bandhu's mic (src/hooks/useVoiceInput.ts).
 * See src/native/NativeVoiceInput.ts for why this is hand-written rather than an npm
 * package.
 *
 * WHY startActivityForResult INSTEAD OF THE HEADLESS SpeechRecognizer CLASS
 * -----------------------------------------------------------------------------
 * An earlier version of this module used android.speech.SpeechRecognizer directly
 * (createSpeechRecognizer + startListening), which binds to a RecognitionService
 * running as a background service inside a separate trusted app's process (normally
 * the Google app). That worked in the emulator but failed consistently on a real,
 * heavily-customized OEM device (a Realme/ColorOS phone): logcat showed Google's own
 * recognizer immediately hitting "MICROPHONE_UNAVAILABLE" (error 102) even though
 * RECORD_AUDIO was granted to both our app and the Google app — `adb shell cmd appops
 * get com.google.android.googlequicksearchbox RECORD_AUDIO` showed its RECORD_AUDIO
 * op-mode pinned to "foreground", and this OEM's aggressive background-process
 * management (visible throughout logcat as OplusHansManager / OplusAppSwitchListener
 * / etc.) doesn't reliably treat a bound background service as "foreground" for that
 * check, even while the calling app is frontmost. This is a known class of failure
 * for the headless RecognitionService approach on heavily-skinned OEM Android builds.
 *
 * Launching RecognizerIntent.ACTION_RECOGNIZE_SPEECH as its own foreground Activity
 * (the decade-old, most broadly compatible approach — the same one Google Assistant's
 * "Speak now" dialog uses) sidesteps this entirely: the recognizer UI itself becomes
 * the foreground activity, so there's no background-service-importance ambiguity for
 * the OS to get wrong. The trade-off is losing live partial-transcript results while
 * speaking (Google's own dialog shows its own live hypothesis instead) — an acceptable
 * cost for something that actually works out of the box on real devices.
 */
class VoiceInputModule(reactContext: ReactApplicationContext) :
  NativeVoiceInputSpec(reactContext), ActivityEventListener {

  private var isManuallyStopped = false

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName(): String = NAME

  private fun sendEvent(eventName: String, params: WritableMap?) {
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, params)
  }

  private fun recognizerIntent(language: String): Intent =
    Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE, language)
      putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
      putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, reactApplicationContext.packageName)
    }

  override fun start(language: String, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("START_FAILED", "No active activity to host the recognizer")
      return
    }

    if (ContextCompat.checkSelfPermission(reactApplicationContext, Manifest.permission.RECORD_AUDIO)
      != PackageManager.PERMISSION_GRANTED
    ) {
      promise.reject("PERMISSION_DENIED", "Microphone permission not granted")
      return
    }

    val intent = recognizerIntent(language)
    if (intent.resolveActivity(reactApplicationContext.packageManager) == null) {
      promise.reject("NOT_AVAILABLE", "No speech recognition app available on this device")
      return
    }

    isManuallyStopped = false
    try {
      activity.startActivityForResult(intent, REQUEST_CODE)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("START_FAILED", "Failed to launch recognizer: ${e.message}", e)
    }
  }

  override fun stop(promise: Promise) {
    // The recognizer runs as the foreground Activity while listening, so there is
    // nothing for us to tear down directly — finishing it is the user's own back
    // gesture/tap on its UI. Marking manual-stop just suppresses the result/error
    // this module would otherwise emit when that dialog closes.
    isManuallyStopped = true
    sendEvent("onSpeechEnd", null)
    promise.resolve(null)
  }

  override fun isAvailable(promise: Promise) {
    val available = recognizerIntent("en-US").resolveActivity(reactApplicationContext.packageManager) != null
    promise.resolve(available)
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_CODE || isManuallyStopped) return

    when (resultCode) {
      Activity.RESULT_OK -> {
        val matches = data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
        val scores = data?.getFloatArrayExtra(RecognizerIntent.EXTRA_CONFIDENCE_SCORES)
        val transcript = matches?.firstOrNull()
        if (!transcript.isNullOrEmpty()) {
          val event = Arguments.createMap()
          event.putString("transcript", transcript)
          event.putBoolean("isFinal", true)
          event.putDouble("confidence", scores?.getOrNull(0)?.toDouble() ?: 0.0)
          sendEvent("onSpeechResult", event)
        }
        sendEvent("onSpeechEnd", null)
      }
      Activity.RESULT_CANCELED -> {
        // The user backed out of the recognizer dialog (or it found nothing to
        // say) — a normal outcome for a push-to-talk button, not a failure.
        sendEvent("onSpeechEnd", null)
      }
      else -> {
        val event = Arguments.createMap()
        event.putString("code", "UNKNOWN_ERROR")
        event.putString("message", "Speech recognition activity returned result code $resultCode")
        sendEvent("onSpeechError", event)
      }
    }
  }

  override fun onNewIntent(intent: Intent) {}

  companion object {
    const val NAME = "NativeVoiceInput"
    private const val REQUEST_CODE = 8730
  }
}
