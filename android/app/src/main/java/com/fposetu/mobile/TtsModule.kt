package com.fposetu.mobile

import android.speech.tts.TextToSpeech
import com.facebook.react.bridge.ReactApplicationContext
import java.util.Locale

/**
 * Text-to-speech TurboModule — a thin wrapper over Android's built-in
 * android.speech.tts.TextToSpeech. Backs src/hooks/useSpeech.ts ("Listen" buttons).
 *
 * See src/native/NativeTts.ts for why this is hand-written rather than an npm package.
 *
 * TextToSpeech initialises asynchronously, so a speak() that arrives before the engine
 * is ready is stashed in `pending` and replayed from onInit — otherwise the first tap
 * of a "Listen" button after a cold start would silently do nothing.
 */
class TtsModule(reactContext: ReactApplicationContext) :
  NativeTtsSpec(reactContext), TextToSpeech.OnInitListener {

  private data class Utterance(val text: String, val language: String, val rate: Double)

  private var engine: TextToSpeech? = null
  private var ready = false
  private var pending: Utterance? = null

  init {
    engine = TextToSpeech(reactContext.applicationContext, this)
  }

  override fun getName(): String = NAME

  override fun onInit(status: Int) {
    ready = status == TextToSpeech.SUCCESS
    val queued = pending
    pending = null
    if (ready && queued != null) {
      speakNow(queued.text, queued.language, queued.rate)
    }
  }

  override fun speak(text: String, language: String, rate: Double) {
    if (!ready) {
      pending = Utterance(text, language, rate)
      return
    }
    speakNow(text, language, rate)
  }

  private fun speakNow(text: String, language: String, rate: Double) {
    val tts = engine ?: return
    tts.stop()

    // Fall back to the device default when the requested language pack isn't
    // installed — speaking in the wrong accent beats speaking not at all.
    val result = tts.setLanguage(Locale.forLanguageTag(language))
    if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
      tts.language = Locale.getDefault()
    }

    tts.setSpeechRate(rate.toFloat())
    tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, UTTERANCE_ID)
  }

  override fun stop() {
    engine?.stop()
  }

  override fun invalidate() {
    engine?.stop()
    engine?.shutdown()
    engine = null
    ready = false
    pending = null
    super.invalidate()
  }

  companion object {
    const val NAME = "NativeTts"
    private const val UTTERANCE_ID = "fposetu-tts"
  }
}
