package com.parentalmonitor.child.services

import android.content.Context
import android.provider.CallLog
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

class CallLogService(private val ctx: Context) {

    companion object {
        private const val TAG       = "CallLogService"
        private const val PREFS     = "pm_calllogs"
        private const val KEY_SINCE = "last_calllog_ts"
    }

    /** Reads new call logs since last sync and uploads to /api/events/batch. */
    fun syncCallLogs(token: String, deviceId: String, baseUrl: String) {
        val permGranted = ctx.checkSelfPermission(android.Manifest.permission.READ_CALL_LOG) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
        if (!permGranted) {
            android.util.Log.w(TAG, "SKIP — READ_CALL_LOG permission not granted")
            return
        }

        val prefs    = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val sinceMs  = prefs.getLong(KEY_SINCE, 0L)
        android.util.Log.d(TAG, "Querying call logs since epoch $sinceMs …")

        val logsJson = getCallLogs(sinceMs)
        val logs     = try { JSONArray(logsJson) } catch (_: Exception) { return }
        if (logs.length() == 0) {
            android.util.Log.d(TAG, "No new call logs since last sync")
            return
        }
        android.util.Log.d(TAG, "Found ${logs.length()} new call log(s) — uploading …")

        var latestTs = sinceMs
        val events   = JSONArray()
        for (i in 0 until logs.length()) {
            val log = logs.getJSONObject(i)
            val ts  = log.optLong("timestamp", 0L)
            if (ts > latestTs) latestTs = ts
            events.put(JSONObject().apply {
                put("id",      "${deviceId}_call_${log.optString("id")}")
                put("type",    "callLog")
                put("payload", log)
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
                android.util.Log.d(TAG, "Synced ${logs.length()} call logs ✓")
            } else {
                android.util.Log.w(TAG, "Call log sync HTTP $code")
            }
        } catch (e: Exception) {
            android.util.Log.w(TAG, "Call log sync failed: ${e.message}")
        }
    }

    fun getCallLogs(sinceTimestamp: Long = 0L): String {
        val result = JSONArray()
        try {
            val projection = arrayOf(
                CallLog.Calls._ID,
                CallLog.Calls.NUMBER,
                CallLog.Calls.CACHED_NAME,
                CallLog.Calls.TYPE,
                CallLog.Calls.DURATION,
                CallLog.Calls.DATE,
            )
            val selection = if (sinceTimestamp > 0) "${CallLog.Calls.DATE} > ?" else null
            val selArgs   = if (sinceTimestamp > 0) arrayOf(sinceTimestamp.toString()) else null

            // NOTE: Do NOT put LIMIT inside the sortOrder string — it is not
            // part of the ContentProvider API and throws on many Android versions.
            // Limit the result manually during cursor iteration instead.
            ctx.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                projection,
                selection,
                selArgs,
                "${CallLog.Calls.DATE} DESC",
            )?.use { cursor ->
                val numberIdx = cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER)
                val nameIdx   = cursor.getColumnIndexOrThrow(CallLog.Calls.CACHED_NAME)
                val typeIdx   = cursor.getColumnIndexOrThrow(CallLog.Calls.TYPE)
                val durIdx    = cursor.getColumnIndexOrThrow(CallLog.Calls.DURATION)
                val dateIdx   = cursor.getColumnIndexOrThrow(CallLog.Calls.DATE)

                var count = 0
                while (cursor.moveToNext() && count < 200) {
                    val callType = when (cursor.getInt(typeIdx)) {
                        CallLog.Calls.INCOMING_TYPE -> "incoming"
                        CallLog.Calls.OUTGOING_TYPE -> "outgoing"
                        CallLog.Calls.MISSED_TYPE   -> "missed"
                        CallLog.Calls.REJECTED_TYPE -> "rejected"
                        else                        -> "missed"
                    }
                    result.put(JSONObject().apply {
                        put("id",        UUID.randomUUID().toString())
                        put("number",    cursor.getString(numberIdx) ?: "")
                        put("name",      cursor.getString(nameIdx))
                        put("type",      callType)
                        put("duration",  cursor.getInt(durIdx))
                        put("timestamp", cursor.getLong(dateIdx))
                    })
                    count++
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("CallLogService", "Failed to read call log: ${e.message}", e)
        }
        return result.toString()
    }
}
