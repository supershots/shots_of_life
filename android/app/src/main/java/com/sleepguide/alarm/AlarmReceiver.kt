package com.sleepguide.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.sleepguide.MainActivity
import com.sleepguide.R

/**
 * 22:50 に setAlarmClock() から呼ばれる。全画面通知（USE_FULL_SCREEN_INTENT）を
 * USAGE_ALARM の音で鳴らす。USAGE_ALARM は DND の既定例外なので、おやすみモード中でも
 * 鳴る（6章）。
 *
 * ここでは「鳴らす」ことだけをやる。実際の通話（vapi.start）はユーザーが応答してから
 * JS 側で行う。
 */
class AlarmReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      AlarmConstants.ACTION_DECLINE -> {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(AlarmConstants.NOTIFICATION_ID)
        return
      }
      else -> showIncomingNotification(context)
    }
  }

  private fun showIncomingNotification(context: Context) {
    // 通知を組み立てて投げるだけの短い処理。ここで長時間ブロックしない。
    val wakeLock = (context.getSystemService(Context.POWER_SERVICE) as PowerManager)
        .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "sleepguide:alarm")
    wakeLock.acquire(10_000L)

    try {
      ensureChannel(context)

      val fullScreenIntent = Intent(context, MainActivity::class.java).apply {
        addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP)
        putExtra(AlarmConstants.EXTRA_INCOMING_ALARM, true)
      }
      val fullScreenPendingIntent = PendingIntent.getActivity(
          context,
          AlarmConstants.REQUEST_CODE,
          fullScreenIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

      val declineIntent = Intent(context, AlarmReceiver::class.java).apply {
        action = AlarmConstants.ACTION_DECLINE
      }
      val declinePendingIntent = PendingIntent.getBroadcast(
          context,
          AlarmConstants.REQUEST_CODE + 1,
          declineIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

      val notification = NotificationCompat.Builder(context, AlarmConstants.CHANNEL_ID)
          .setSmallIcon(R.drawable.ic_notification)
          .setContentTitle(context.getString(R.string.incoming_call_title))
          .setContentText(context.getString(R.string.incoming_call_text))
          .setCategory(NotificationCompat.CATEGORY_ALARM)
          .setPriority(NotificationCompat.PRIORITY_HIGH)
          .setFullScreenIntent(fullScreenPendingIntent, true)
          .setContentIntent(fullScreenPendingIntent)
          .addAction(0, context.getString(R.string.incoming_call_decline), declinePendingIntent)
          .setOngoing(true)
          .setAutoCancel(false)
          .build()

      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.notify(AlarmConstants.NOTIFICATION_ID, notification)
    } finally {
      if (wakeLock.isHeld) wakeLock.release()
    }
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (nm.getNotificationChannel(AlarmConstants.CHANNEL_ID) != null) return

    val alarmAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ALARM)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
    val soundUri = RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_ALARM)
        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)

    val channel = NotificationChannel(
        AlarmConstants.CHANNEL_ID,
        context.getString(R.string.incoming_call_channel_name),
        NotificationManager.IMPORTANCE_HIGH)
    channel.description = context.getString(R.string.incoming_call_channel_description)
    channel.setSound(soundUri, alarmAttributes)
    channel.enableVibration(true)
    channel.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    nm.createNotificationChannel(channel)
  }
}
