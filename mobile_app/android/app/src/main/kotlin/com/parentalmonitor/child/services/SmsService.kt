package com.parentalmonitor.child.services

import android.content.Context
import android.provider.Telephony
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Reads SMS inbox/sent/outbox from the system content provider and uploads
 * new messages to the backend via /api/events/batch.
 */
class SmsService(private val ctx: Context, private val baseUrl: String) {

    companion object {
        private const val TAG       = "SmsService"
        private const val PREFS     = "pm_sms"
        private const val KEY_SINCE = "last_sms_ts"
        private const val BATCH_MAX = 200
    }

    /** Call from the slow capture tick. */
    fun syncSms(token: String, deviceId: String) {
        if (ctx.checkSelfPermission(android.Manifest.permission.READ_SMS)
            != android.content.pm.PackageManager.PERMISSION_GRANTED) return

        val prefs    = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val sinceMs  = prefs.getLong(KEY_SINCE, 0L)
        var latestTs = sinceMs

        val messages = readSms(sinceMs)
        if (messages.isEmpty()) return

        // Build events batch
        val events = JSONArray()
        messages.forEach { msg ->
            val ts = msg.getLong("date")
            if (ts > latestTs) latestTs = ts

            events.put(JSONObject().apply {
                put("id",      "${deviceId}_sms_${msg.getString("id")}")
                put("type",    "smsLog")
                put("payload", msg)
            })
        }

        val body = JSONObject().apply {
            put("deviceId", deviceId)
            put("events",   events)
        }.toString().toByteArray(Charsets.UTF_8)

        try {
            val conn = (URL("$baseUrl/api/events/batch").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Authorization", "Bearer $token")
                setRequestProperty("Content-Type",  "application/json")
                doOutput       = true
                connectTimeout = 15_000
                readTimeout    = 30_000
                setFixedLengthStreamingMode(body.size.toLong())
            }
            conn.outputStream.use { it.write(body) }
            val code = conn.responseCode
            conn.disconnect()
            if (code == 200 || code == 201) {
                prefs.edit().putLong(KEY_SINCE, latestTs).apply()
                android.util.Log.d(TAG, "Synced ${messages.size} SMS messages ✓")
            } else {
                android.util.Log.w(TAG, "SMS sync HTTP $code")
            }
        } catch (e: Exception) {
            android.util.Log.w(TAG, "SMS sync failed: ${e.message}")
        }
    }

    private fun readSms(sinceMs: Long): List<JSONObject> {
        val result  = mutableListOf<JSONObject>()
        val uri     = Telephony.Sms.CONTENT_URI
        val columns = arrayOf(
            Telephony.Sms._ID,
            Telephony.Sms.ADDRESS,
            Telephony.Sms.BODY,
            Telephony.Sms.TYPE,
            Telephony.Sms.DATE,
            Telephony.Sms.READ,
            Telephony.Sms.THREAD_ID,
            Telephony.Sms.SUBJECT,
        )

        val selection = if (sinceMs > 0) "${Telephony.Sms.DATE} > ?" else null
        val selArgs   = if (sinceMs > 0) arrayOf(sinceMs.toString()) else null
        val sortOrder = "${Telephony.Sms.DATE} DESC LIMIT $BATCH_MAX"

        ctx.contentResolver.query(uri, columns, selection, selArgs, sortOrder)?.use { cursor ->
            val idIdx      = cursor.getColumnIndexOrThrow(Telephony.Sms._ID)
            val addrIdx    = cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
            val bodyIdx    = cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)
            val typeIdx    = cursor.getColumnIndexOrThrow(Telephony.Sms.TYPE)
            val dateIdx    = cursor.getColumnIndexOrThrow(Telephony.Sms.DATE)
            val readIdx    = cursor.getColumnIndexOrThrow(Telephony.Sms.READ)
            val threadIdx  = cursor.getColumnIndexOrThrow(Telephony.Sms.THREAD_ID)
            val subjectIdx = cursor.getColumnIndexOrThrow(Telephony.Sms.SUBJECT)

            while (cursor.moveToNext()) {
                result.add(JSONObject().apply {
                    put("id",       cursor.getString(idIdx)  ?: "")
                    put("address",  cursor.getString(addrIdx) ?: "")
                    put("body",     cursor.getString(bodyIdx) ?: "")
                    put("type",     cursor.getInt(typeIdx))   // 1=inbox 2=sent 3=draft
                    put("date",     cursor.getLong(dateIdx))
                    put("read",     cursor.getInt(readIdx) == 1)
                    put("threadId", cursor.getString(threadIdx) ?: "")
                    put("subject",  cursor.getString(subjectIdx) ?: "")
                })
            }
        }
        return result
    }
}
