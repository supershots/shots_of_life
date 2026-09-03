package com.sleepguide.alarm

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.sleepguide.MainActivity

/**
 * MainActivity がコールドスタートで着信 Intent を受け取ったとき、JS 側の
 * NativeEventEmitter がまだ購読を始めていないことがある。その場合に備えて
 * "着信フラグ" を一度だけ読める形で保持しておくブリッジ。
 *
 * 既にアプリが起動していた場合（onNewIntent）は MainActivity から直接
 * "onIncomingAlarm" イベントが飛ぶので、JS 側は起動直後にこの
 * consumeLaunchFlag() を1回呼び、その後は onIncomingAlarm を購読すればよい。
 */
class IncomingAlarmModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "IncomingAlarm"

  @ReactMethod
  fun consumeLaunchFlag(promise: Promise) {
    val value = MainActivity.pendingIncomingAlarm
    MainActivity.pendingIncomingAlarm = false
    promise.resolve(value)
  }

  // NativeEventEmitter (JS) は addListener/removeListeners の存在を要求する。
  @ReactMethod
  fun addListener(eventName: String) {}

  @ReactMethod
  fun removeListeners(count: Int) {}
}
