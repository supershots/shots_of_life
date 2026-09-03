package com.sleepguide.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.sleepguide.MainActivity
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Calendar

/**
 * 06章: 着信。setAlarmClock() で毎晩の呼びかけをスケジュールする。
 *
 * setAlarmClock() を選ぶ理由は仕様どおり: Doze を完全免除され、DND 例外の対象にもなる
 * "最も強いアラーム API"。だからサーバーもプッシュも要らない。
 */
class AlarmSchedulerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AlarmScheduler"

  private fun alarmManager(): AlarmManager =
      reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  private fun pendingIntent(): PendingIntent {
    val intent = Intent(reactContext, AlarmReceiver::class.java).apply {
      action = AlarmConstants.ACTION_FIRE_ALARM
    }
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    return PendingIntent.getBroadcast(reactContext, AlarmConstants.REQUEST_CODE, intent, flags)
  }

  private fun scheduleAtTimestamp(timestampMs: Long) {
    // ステータスバーの目覚まし時計アイコンをタップしたときに開く画面。
    // ここを AlarmReceiver と同じ Intent にすると PendingIntent が衝突して
    // タップしただけで着信扱いになってしまうため、必ずアプリを開くだけの
    // 別 Intent にする。
    val showIntent = Intent(reactContext, MainActivity::class.java)
    val showPendingIntent = PendingIntent.getActivity(
        reactContext,
        AlarmConstants.REQUEST_CODE,
        showIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    val info = AlarmManager.AlarmClockInfo(timestampMs, showPendingIntent)
    alarmManager().setAlarmClock(info, pendingIntent())
  }

  /**
   * 指定した時:分の直近の未来時刻（今日その時刻を過ぎていれば翌日）に1回だけ鳴らす。
   * 呼び出すたびに前回の予約は上書きされる（毎回セットし直す。繰り返しにしない → 5章 の
   * 「今日はやめる」を実現するため、翌日ぶんは通話終了時に毎回明示的に張り直す設計）。
   */
  @ReactMethod
  fun scheduleNext(hour: Double, minute: Double, promise: Promise) {
    try {
      val target = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, hour.toInt())
        set(Calendar.MINUTE, minute.toInt())
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
        if (timeInMillis <= System.currentTimeMillis()) {
          add(Calendar.DAY_OF_YEAR, 1)
        }
      }
      scheduleAtTimestamp(target.timeInMillis)

      val result = Arguments.createMap()
      result.putDouble("timestamp", target.timeInMillis.toDouble())
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("SCHEDULE_FAILED", e.message, e)
    }
  }

  /**
   * 6章②「再着信」用。任意のタイムスタンプに1回だけ全画面着信を鳴らす。
   * 途中で切られた/出なかった通話を、モード依存の間隔で掛け直すために使う。
   */
  @ReactMethod
  fun scheduleAt(timestampMs: Double, promise: Promise) {
    try {
      scheduleAtTimestamp(timestampMs.toLong())
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("SCHEDULE_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun cancel(promise: Promise) {
    try {
      alarmManager().cancel(pendingIntent())
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("CANCEL_FAILED", e.message, e)
    }
  }

  /** Android 12+ で SCHEDULE_EXACT_ALARM/USE_EXACT_ALARM が実際に許可されているか。 */
  @ReactMethod
  fun canScheduleExactAlarms(promise: Promise) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      promise.resolve(alarmManager().canScheduleExactAlarms())
    } else {
      promise.resolve(true)
    }
  }
}
