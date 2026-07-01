package com.parentalmonitor.child.receivers

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.core.app.NotificationCompat
import com.parentalmonitor.child.activities.AlarmActivity

/**
 * Fires when a remotely-scheduled alarm or reminder reaches its trigger time
 * (scheduled via AlarmManager in RemoteCommandService).
 *
 * Extras:
 *   EXTRA_KIND    → "alarm" | "reminder"
 *   EXTRA_TITLE   → notification/alarm title
 *   EXTRA_MESSAGE → body text (reminders)
 *   EXTRA_ID      → stable id used for notification id + dismiss action
 */
class AlarmReminderReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action

        // Dismiss action from the full-screen alarm / notification.
        if (action == ACTION_DISMISS) {
            stopAlarmSound()
            val id = intent.getStringExtra(EXTRA_ID) ?: return
            cancelNotification(context, id)
            return
        }

        val kind    = intent.getStringExtra(EXTRA_KIND) ?: "reminder"
        val title   = intent.getStringExtra(EXTRA_TITLE)?.takeIf { it.isNotBlank() }
            ?: if (kind == "alarm") "Alarm" else "Reminder"
        val message = intent.getStringExtra(EXTRA_MESSAGE) ?: ""
        val id      = intent.getStringExtra(EXTRA_ID) ?: title

        ensureChannels(context)

        when (kind) {
            // Loud, full-screen ringing alerts (bypass silent via STREAM_ALARM).
            "alarm", "ring", "sos" -> showLoudAlert(context, id, kind, title, message)
            // On-screen text alerts with a single tone.
            else                   -> showTextAlert(context, id, kind, title, message)
        }
    }

    // ── Text alert: on-screen message + single tone ────────────────────────────
    // NOTE: this app deliberately does NOT request POST_NOTIFICATIONS (stealth),
    // so on Android 13+ a plain notification is silently dropped. To make the
    // alert actually reach the child we show an on-screen screen (like the alarm)
    // and play a single tone. The notification is still posted best-effort in case
    // the permission is ever granted.
    // Used for: reminder, notification (send message to child), emergency message.
    private fun showTextAlert(context: Context, id: String, kind: String, title: String, message: String) {
        val notif = NotificationCompat.Builder(context, CHANNEL_REMINDER)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .build()
        (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .notify(id.hashCode(), notif)

        playReminderSound(context)

        val screen = Intent(context, AlarmActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            putExtra(EXTRA_KIND, kind)
            putExtra(EXTRA_TITLE, title)
            putExtra(EXTRA_MESSAGE, message)
            putExtra(EXTRA_ID, id)
        }
        try { context.startActivity(screen) } catch (_: Exception) {}
    }

    // ── Loud alert: full-screen ringing + looping sound + vibration ─────────────
    // Used for: alarm, ring (ring even if silent), sos (emergency siren).
    private fun showLoudAlert(context: Context, id: String, kind: String, title: String, message: String) {
        // ring / sos should override a silent ringer — force the alarm stream up.
        startAlarmSound(context, maxVolume = kind == "ring" || kind == "sos")

        val fullScreenIntent = Intent(context, AlarmActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            putExtra(EXTRA_KIND, kind)
            putExtra(EXTRA_ID, id)
            putExtra(EXTRA_TITLE, title)
            putExtra(EXTRA_MESSAGE, message)
        }
        val fsPending = PendingIntent.getActivity(
            context, id.hashCode(), fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val dismissIntent = Intent(context, AlarmReminderReceiver::class.java).apply {
            this.action = ACTION_DISMISS
            putExtra(EXTRA_ID, id)
        }
        val dismissPending = PendingIntent.getBroadcast(
            context, ("dismiss_$id").hashCode(), dismissIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notif = NotificationCompat.Builder(context, CHANNEL_ALARM)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(title)
            .setContentText(message.ifBlank { "Alarm" })
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fsPending, true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Dismiss", dismissPending)
            .build()
        (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .notify(id.hashCode(), notif)

        // Also launch the full-screen activity directly (fires reliably when the
        // process is already alive; the full-screen intent covers the locked case).
        try { context.startActivity(fullScreenIntent) } catch (_: Exception) {}
    }

    private fun cancelNotification(context: Context, id: String) {
        (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .cancel(id.hashCode())
    }

    private fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (nm.getNotificationChannel(CHANNEL_ALARM) == null) {
            nm.createNotificationChannel(NotificationChannel(
                CHANNEL_ALARM, "Alarms", NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Remotely scheduled alarms"
                enableVibration(true)
                setBypassDnd(true)
            })
        }
        if (nm.getNotificationChannel(CHANNEL_REMINDER) == null) {
            nm.createNotificationChannel(NotificationChannel(
                CHANNEL_REMINDER, "Reminders", NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Remotely scheduled reminders"
                enableVibration(true)
            })
        }
    }

    companion object {
        const val CHANNEL_ALARM    = "pm_alarm_channel"
        const val CHANNEL_REMINDER = "pm_reminder_channel"

        const val ACTION_DISMISS = "com.parentalmonitor.child.ACTION_ALARM_DISMISS"

        const val EXTRA_KIND    = "extra_kind"
        const val EXTRA_TITLE   = "extra_title"
        const val EXTRA_MESSAGE = "extra_message"
        const val EXTRA_ID      = "extra_id"

        @Volatile private var player: MediaPlayer? = null
        @Volatile private var vibrator: Vibrator? = null

        fun startAlarmSound(context: Context, maxVolume: Boolean = false) {
            stopAlarmSound()
            if (maxVolume) {
                // Ring / SOS must be audible even if the phone is on silent —
                // raise the ALARM stream (which already bypasses ringer mode) to max.
                try {
                    val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
                    am.setStreamVolume(
                        AudioManager.STREAM_ALARM,
                        am.getStreamMaxVolume(AudioManager.STREAM_ALARM),
                        0,
                    )
                } catch (_: Exception) {}
            }
            try {
                val uri = RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_ALARM)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                player = MediaPlayer().apply {
                    setDataSource(context, uri)
                    setAudioStreamType(AudioManager.STREAM_ALARM)
                    isLooping = true
                    prepare()
                    start()
                }
            } catch (_: Exception) {}

            try {
                val v = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                val pattern = longArrayOf(0, 800, 600)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(VibrationEffect.createWaveform(pattern, 0))
                } else {
                    @Suppress("DEPRECATION") v.vibrate(pattern, 0)
                }
                vibrator = v
            } catch (_: Exception) {}
        }

        /** Single, non-looping notification tone + short vibration for reminders. */
        fun playReminderSound(context: Context) {
            stopAlarmSound()
            try {
                val uri = RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_NOTIFICATION)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                player = MediaPlayer().apply {
                    setDataSource(context, uri)
                    setAudioStreamType(AudioManager.STREAM_NOTIFICATION)
                    isLooping = false
                    prepare()
                    start()
                }
            } catch (_: Exception) {}

            try {
                val v = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(VibrationEffect.createOneShot(500, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION") v.vibrate(500)
                }
            } catch (_: Exception) {}
        }

        fun stopAlarmSound() {
            try { player?.stop(); player?.release() } catch (_: Exception) {}
            player = null
            try { vibrator?.cancel() } catch (_: Exception) {}
            vibrator = null
        }
    }
}
