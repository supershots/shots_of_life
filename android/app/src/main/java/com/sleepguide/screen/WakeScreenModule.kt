package com.sleepguide.screen

import android.app.Activity
import android.view.WindowManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

/**
 * 画面を「点けっぱなしにする」「手放す」の2つだけを担当する。
 *
 * 6章「15分放置でスリープへ」: 通話終了後、無操作が15分続いたら release() を呼ぶ。
 * ここで端末を明示的にロックはしない — DevicePolicyManager.lockNow() はデバイス管理者
 * 権限が要る重い話で、この用途には見合わない。FLAG_KEEP_SCREEN_ON を外すだけで
 * OS 標準のスリープタイムアウトが効いて、自然に暗くなる。
 */
class WakeScreenModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "WakeScreen"

  @ReactMethod
  fun keepAwake(promise: Promise) {
    withActivity(promise) { activity ->
      activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
  }

  @ReactMethod
  fun release(promise: Promise) {
    withActivity(promise) { activity ->
      activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
  }

  private inline fun withActivity(promise: Promise, crossinline block: (Activity) -> Unit) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.resolve(false)
      return
    }
    UiThreadUtil.runOnUiThread {
      block(activity)
      promise.resolve(true)
    }
  }
}
