package com.sleepguide.call

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** JS から通話中フォアグラウンドサービスの開始/終了を叩くためのブリッジ。 */
class CallServiceModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "CallService"

  @ReactMethod
  fun start(promise: Promise) {
    try {
      val intent = Intent(reactContext, CallForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        reactContext.startForegroundService(intent)
      } else {
        reactContext.startService(intent)
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("CALL_SERVICE_START_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    try {
      reactContext.stopService(Intent(reactContext, CallForegroundService::class.java))
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("CALL_SERVICE_STOP_FAILED", e.message, e)
    }
  }
}
