package com.sleepguide.alarm

import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * 06章: 着信。setAlarmClock() で毎晩の呼びかけをスケジュールする。
 *
 * setAlarmClock() を選ぶ理由は仕様どおり: Doze を完全免除され、DND 例外の対象にもなる
 * "最も強いアラーム API"。だからサーバーもプッシュも要らない。
 *
 * 実体は [AlarmScheduling]（端末再起動直後に React Native なしで呼ぶ [BootReceiver] と
 * 共有するため）。このクラスは JS ⇔ ネイティブの橋渡しだけを担当する。
 */
class AlarmSchedulerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AlarmScheduler"

  /**
   * 指定した時:分の直近の未来時刻（今日その時刻を過ぎていれば翌日）に1回だけ鳴らす。
   * 呼び出すたびに前回の予約は上書きされる（毎回セットし直す。繰り返しにしない → 5章 の
   * 「今日はやめる」を実現するため、翌日ぶんは通話終了時に毎回明示的に張り直す設計）。
   */
  @ReactMethod
  fun scheduleNext(hour: Double, minute: Double, promise: Promise) {
    try {
      val timestamp = AlarmScheduling.nextOccurrence(hour.toInt(), minute.toInt())
      AlarmScheduling.scheduleAt(reactContext, timestamp)

      val result = Arguments.createMap()
      result.putDouble("timestamp", timestamp.toDouble())
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
      AlarmScheduling.scheduleAt(reactContext, timestampMs.toLong())
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("SCHEDULE_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun cancel(promise: Promise) {
    try {
      AlarmScheduling.cancel(reactContext)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("CANCEL_FAILED", e.message, e)
    }
  }

  /** Android 12+ で SCHEDULE_EXACT_ALARM/USE_EXACT_ALARM が実際に許可されているか。 */
  @ReactMethod
  fun canScheduleExactAlarms(promise: Promise) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      promise.resolve(AlarmScheduling.alarmManager(reactContext).canScheduleExactAlarms())
    } else {
      promise.resolve(true)
    }
  }
}
