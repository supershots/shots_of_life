package com.sleepguide

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.sleepguide.alarm.AlarmSchedulerModule
import com.sleepguide.alarm.IncomingAlarmModule
import com.sleepguide.call.CallServiceModule
import com.sleepguide.screen.WakeScreenModule

/** アプリ独自のネイティブモジュール（3章〜6章）をまとめて登録する。 */
class SleepGuidePackage : ReactPackage {

  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
      listOf(
          AlarmSchedulerModule(reactContext),
          IncomingAlarmModule(reactContext),
          CallServiceModule(reactContext),
          WakeScreenModule(reactContext))

  override fun createViewManagers(
      reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}
