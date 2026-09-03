package com.sleepguide.call

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.sleepguide.R

/**
 * 通話中（vapi.start〜call-end まで）だけ生きるフォアグラウンドサービス。
 * マイクを使うので foregroundServiceType="microphone"（6章「実装の流れ」4番）。
 *
 * 通話そのものは JS 側（@vapi-ai/react-native）が握っている。このサービスは
 * 「アプリがバックグラウンドに回ってもプロセスを OS に殺されない」ためだけに存在する。
 */
class CallForegroundService : Service() {

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    beginForeground()
    return START_STICKY
  }

  // Service.startForeground() と同名にすると、後方互換の2引数オーバーロードの
  // 解決でコンパイラが混乱するため、あえて別名にしてある。
  private fun beginForeground() {
    ensureChannel()
    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_notification)
        .setContentTitle(getString(R.string.call_service_notification_title))
        .setContentText(getString(R.string.call_service_notification_text))
        .setOngoing(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .build()

    ServiceCompat.startForeground(
        this,
        NOTIFICATION_ID,
        notification,
        ServiceCompat.FOREGROUND_SERVICE_TYPE_MICROPHONE)
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (nm.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(
        CHANNEL_ID,
        getString(R.string.call_service_notification_title),
        NotificationManager.IMPORTANCE_LOW)
    channel.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    nm.createNotificationChannel(channel)
  }

  override fun onDestroy() {
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }

  companion object {
    private const val CHANNEL_ID = "sleepguide.call_service"
    private const val NOTIFICATION_ID = 3001
  }
}
