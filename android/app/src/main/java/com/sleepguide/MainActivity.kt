package com.sleepguide

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.sleepguide.alarm.AlarmConstants

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "SleepGuide"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    // RN の既定どおり savedInstanceState は渡さない（Fragment 復元まわりの既知の問題を避ける）。
    super.onCreate(null)
    applyIncomingAlarmFlagsIfNeeded(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    if (isIncomingAlarm(intent)) {
      applyIncomingAlarmFlagsIfNeeded(intent)
      // アプリが既に起動していた（singleTask で onNewIntent が呼ばれた）ケース。
      // JS は既に onIncomingAlarm を購読できているはずなので、直接イベントを飛ばす。
      emitIncomingAlarmEvent()
    }
  }

  private fun isIncomingAlarm(intent: Intent?): Boolean =
      intent?.getBooleanExtra(AlarmConstants.EXTRA_INCOMING_ALARM, false) == true

  /** 6章: ロック画面の上に全画面で出す。デバイス管理者権限は使わない。 */
  private fun applyIncomingAlarmFlagsIfNeeded(intent: Intent?) {
    if (!isIncomingAlarm(intent)) return

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
          WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
              WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
              WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD)
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

    // コールドスタートの場合、JS はまだ onIncomingAlarm を購読できていないので
    // フラグを立てておき、JS 起動後に IncomingAlarm.consumeLaunchFlag() で読ませる。
    pendingIncomingAlarm = true
  }

  private fun emitIncomingAlarmEvent() {
    (application as? MainApplication)
        ?.reactNativeHost
        ?.reactInstanceManager
        ?.currentReactContext
        ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        ?.emit("onIncomingAlarm", null)
  }

  companion object {
    @Volatile
    var pendingIncomingAlarm: Boolean = false
  }
}
