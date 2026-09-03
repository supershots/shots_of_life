package com.sleepguide.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.sleepguide.MainActivity
import java.util.Calendar

/**
 * AlarmManager 呼び出しの実体。JS から叩く [AlarmSchedulerModule] と、端末再起動直後
 * （React Native がまだ動いていない）に叩く [BootReceiver] の両方から使う共通処理。
 */
object AlarmScheduling {
  /** src/config/schedule.ts の BEDTIME_HOUR/BEDTIME_MINUTE と値を揃えること。 */
  const val DEFAULT_BEDTIME_HOUR = 22
  const val DEFAULT_BEDTIME_MINUTE = 50

  fun alarmManager(context: Context): AlarmManager =
      context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  private fun operationPendingIntent(context: Context): PendingIntent {
    val intent = Intent(context, AlarmReceiver::class.java).apply {
      action = AlarmConstants.ACTION_FIRE_ALARM
    }
    return PendingIntent.getBroadcast(
        context,
        AlarmConstants.REQUEST_CODE,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  fun cancel(context: Context) {
    alarmManager(context).cancel(operationPendingIntent(context))
  }

  fun scheduleAt(context: Context, timestampMs: Long) {
    // ステータスバーの目覚まし時計アイコンをタップしたときに開く画面。
    // AlarmReceiver と同じ Intent にすると PendingIntent が衝突してタップしただけで
    // 着信扱いになってしまうため、必ずアプリを開くだけの別 Intent にする。
    val showIntent = Intent(context, MainActivity::class.java)
    val showPendingIntent = PendingIntent.getActivity(
        context,
        AlarmConstants.REQUEST_CODE,
        showIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    val info = AlarmManager.AlarmClockInfo(timestampMs, showPendingIntent)
    alarmManager(context).setAlarmClock(info, operationPendingIntent(context))
  }

  /** 指定した時:分の直近の未来時刻（今日その時刻を過ぎていれば翌日）。 */
  fun nextOccurrence(hour: Int, minute: Int): Long {
    val target = Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, hour)
      set(Calendar.MINUTE, minute)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
      if (timeInMillis <= System.currentTimeMillis()) {
        add(Calendar.DAY_OF_YEAR, 1)
      }
    }
    return target.timeInMillis
  }

  /** 端末再起動直後など、React Native 側からまだ呼べないところから毎晩の着信を張り直す。 */
  fun scheduleDefaultBedtime(context: Context) {
    scheduleAt(context, nextOccurrence(DEFAULT_BEDTIME_HOUR, DEFAULT_BEDTIME_MINUTE))
  }
}
