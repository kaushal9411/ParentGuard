package com.parentalmonitor.child.services

import android.content.Context
import android.util.Log
import com.parentalmonitor.child.listeners.NotificationMonitorService
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

/**
 * Reads the notification queue written by [NotificationMonitorService] and
 * uploads it directly to the backend as an events/batch POST.
 *
 * Runs inside the persistent Kotlin ForegroundService so it works whether
 * the Flutter engine is active or not.
 */
class NotificationSyncService(private val ctx: Context, private val baseUrl: String) {

    private val isoFmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    fun uploadPending(token: String, deviceId: String) {
        val prefs = ctx.getSharedPreferences(
            NotificationMonitorService.PREFS_KEY, Context.MODE_PRIVATE)
        val json  = prefs.getString(NotificationMonitorService.KEY_QUEUE, "[]") ?: "[]"
        val array = try { JSONArray(json) } catch (_: Exception) { JSONArray() }

        if (array.length() == 0) return

        // Clear queue before upload (restore on failure)
        prefs.edit().putString(NotificationMonitorService.KEY_QUEUE, "[]").apply()

        val events = JSONArray()
        for (i in 0 until array.length()) {
            val n  = array.optJSONObject(i) ?: continue
            val ts = n.optLong("timestamp", System.currentTimeMillis())
            events.put(JSONObject().apply {
                put("id",   UUID.randomUUID().toString())
                put("type", "notification")
                put("payload", JSONObject().apply {
                    put("packageName", n.optString("packageName", ""))
                    put("appName",     n.optString("appName",     ""))
                    put("title",       n.optString("title",       ""))
                    put("body",        n.optString("body",        ""))
                    put("bigText",     JSONObject.NULL)
                    put("postedAt",    isoFmt.format(Date(ts)))
                    put("category",    JSONObject.NULL)
                    put("isRead",      false)
                })
            })
        }

        val body = JSONObject().apply {
            put("deviceId", deviceId)
            put("events",   events)
        }.toString()

        var conn: HttpURLConnection? = null
        try {
            conn = URL("$baseUrl/api/events/batch").openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.connectTimeout = 10_000
            conn.readTimeout    = 15_000
            conn.doOutput       = true

            OutputStreamWriter(conn.outputStream, "UTF-8").use { it.write(body) }

            val code = conn.responseCode
            if (code == 200 || code == 201) {
                Log.d(TAG, "Uploaded ${array.length()} notifications")
            } else {
                Log.w(TAG, "Upload failed HTTP $code — restoring queue")
                prefs.edit().putString(NotificationMonitorService.KEY_QUEUE, json).apply()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Upload exception: ${e.message} — restoring queue")
            prefs.edit().putString(NotificationMonitorService.KEY_QUEUE, json).apply()
        } finally {
            conn?.disconnect()
        }
    }

    companion object {
        private const val TAG = "NotificationSyncService"
    }
}
