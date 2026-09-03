package com.sleepguide.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * 端末再起動（や、一部 OEM が投げる QUICKBOOT_POWERON、アプリ更新後の
 * MY_PACKAGE_REPLACED）で AlarmManager の予約は消える。setAlarmClock() で
 * 張っていても再起動をまたぐと復活しないので、ここで最低限（毎晩22:50）を
 * 張り直す。React Native はまだ動いていない前提なので、[AlarmScheduling] を
 * 直接叩く（JS 側の状態には触れない）。
 *
 * 再着信の待機中（3〜5分間隔）や離席中断中に再起動を挟むような稀なケースまでは
 * 復元しない ── その場合は翌日の通常アラームまで待つことになる。v0 の受け入れ
 * 基準（09章）には含まれていない既知の制限。
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED,
      ACTION_QUICKBOOT_POWERON,
      Intent.ACTION_MY_PACKAGE_REPLACED -> {
        AlarmScheduling.scheduleDefaultBedtime(context)
      }
    }
  }

  companion object {
    private const val ACTION_QUICKBOOT_POWERON = "android.intent.action.QUICKBOOT_POWERON"
  }
}
