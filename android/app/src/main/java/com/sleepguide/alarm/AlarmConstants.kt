package com.sleepguide.alarm

object AlarmConstants {
  const val ACTION_FIRE_ALARM = "com.sleepguide.action.FIRE_ALARM"
  const val ACTION_DECLINE = "com.sleepguide.action.DECLINE_ALARM"
  const val REQUEST_CODE = 1001
  const val NOTIFICATION_ID = 2001
  const val CHANNEL_ID = "sleepguide.incoming_call"

  /** MainActivity への Intent extra。true なら着信画面として起動する。 */
  const val EXTRA_INCOMING_ALARM = "incoming_alarm"
}
