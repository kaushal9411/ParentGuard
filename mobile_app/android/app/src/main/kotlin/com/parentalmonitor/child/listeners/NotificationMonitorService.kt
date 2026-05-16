package com.parentalmonitor.child.listeners

import android.content.pm.PackageManager
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

/**
 * Captures every notification posted on the device.
 *
 * System binds this service automatically once the user grants
 * Notification Access in Settings → Apps → Special App Access.
 *
 * Captured notifications are written to SharedPreferences as a
 * JSON array that Flutter polls via the platform channel.
 * This avoids tight coupling between the listener service
 * (which cannot hold a MethodChannel directly) and Flutter.
 */
class NotificationMonitorService : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val extras = sbn.notification.extras
        val title  = extras.getString("android.title")             ?: ""
        val text   = extras.getCharSequence("android.text")?.toString() ?: ""

        if (title.isBlank() && text.isBlank()) return  // skip empty system pings

        val item = JSONObject().apply {
            put("id",          sbn.key)
            put("packageName", sbn.packageName)
            put("appName",     getAppName(sbn.packageName))
            put("title",       title)
            put("body",        text)
            put("timestamp",   sbn.postTime)
        }

        appendToQueue(item)
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        // Optional: could track dismissals here
    }

    // ── Queue management ──────────────────────────────────────────────────

    private fun appendToQueue(item: JSONObject) {
        val prefs = applicationContext.getSharedPreferences(PREFS_KEY, MODE_PRIVATE)
        val existing = prefs.getString(KEY_QUEUE, "[]")!!
        val array = JSONArray(existing)

        array.put(item)

        // Keep ring-buffer capped to avoid unbounded prefs growth
        val capped = if (array.length() > MAX_QUEUE_SIZE) {
            JSONArray().also { trimmed ->
                val start = array.length() - MAX_QUEUE_SIZE
                for (i in start until array.length()) trimmed.put(array[i])
            }
        } else array

        prefs.edit().putString(KEY_QUEUE, capped.toString()).apply()
    }

    private fun getAppName(pkg: String): String = try {
        packageManager.run {
            getApplicationLabel(getApplicationInfo(pkg, 0)).toString()
        }
    } catch (_: PackageManager.NameNotFoundException) { pkg }

    companion object {
        const val PREFS_KEY     = "pm_notifications"
        const val KEY_QUEUE     = "notification_queue"
        private const val MAX_QUEUE_SIZE = 500
    }
}
