package com.parentalmonitor.child.activities

import android.app.Activity
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import com.parentalmonitor.child.receivers.AlarmReminderReceiver

/**
 * Full-screen ringing alarm shown when a remotely-scheduled alarm fires.
 * Appears over the lock screen and turns the screen on. "Dismiss" stops the
 * looping alarm sound/vibration and closes the screen.
 */
class AlarmActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Show over the lock screen and wake the display.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
            )
        }

        val kind    = intent.getStringExtra(AlarmReminderReceiver.EXTRA_KIND) ?: "alarm"
        val title   = intent.getStringExtra(AlarmReminderReceiver.EXTRA_TITLE)
            ?: if (kind == "reminder") "Reminder" else "Alarm"
        val message = intent.getStringExtra(AlarmReminderReceiver.EXTRA_MESSAGE) ?: ""
        val id      = intent.getStringExtra(AlarmReminderReceiver.EXTRA_ID) ?: title

        setContentView(buildLayout(kind, title, message, id))
    }

    private fun buildLayout(kind: String, title: String, message: String, id: String): View {
        // Per-kind visuals: emoji, background colour, and button label.
        val (emoji, bgColor, buttonLabel) = when (kind) {
            "sos"          -> Triple("🆘", "#7F0000", "Dismiss")
            "ring"         -> Triple("📞", "#0D1B4B", "Dismiss")
            "message"      -> Triple("⚠️", "#B71C1C", "OK")
            "notification" -> Triple("📩", "#1A237E", "OK")
            "reminder"     -> Triple("🔔", "#1A237E", "OK")
            else           -> Triple("⏰", "#0D1B4B", "Dismiss") // alarm
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor(bgColor))
            setPadding(64, 64, 64, 64)
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
        }

        root.addView(TextView(this).apply {
            text = emoji
            textSize = 64f
            gravity = Gravity.CENTER
        })

        root.addView(TextView(this).apply {
            text = title
            textSize = 28f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(0, 32, 0, 8)
        })

        if (message.isNotBlank()) {
            root.addView(TextView(this).apply {
                text = message
                textSize = 18f
                setTextColor(Color.parseColor("#ECEFF1"))
                gravity = Gravity.CENTER
            })
        }

        root.addView(Button(this).apply {
            text = buttonLabel
            textSize = 18f
            setPadding(48, 24, 48, 24)
            val lp = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply { topMargin = 64 }
            layoutParams = lp
            setOnClickListener {
                AlarmReminderReceiver.stopAlarmSound()
                cancelNotification(id)
                finish()
            }
        })

        return root
    }

    private fun cancelNotification(id: String) {
        try {
            (getSystemService(NOTIFICATION_SERVICE) as android.app.NotificationManager)
                .cancel(id.hashCode())
        } catch (_: Exception) {}
    }

    override fun onDestroy() {
        // Safety: if the activity is dismissed by other means, stop the sound.
        AlarmReminderReceiver.stopAlarmSound()
        super.onDestroy()
    }
}
