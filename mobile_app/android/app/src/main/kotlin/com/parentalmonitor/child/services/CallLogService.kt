package com.parentalmonitor.child.services

import android.content.Context
import android.provider.CallLog
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

class CallLogService(private val ctx: Context) {

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
                CallLog.Calls.PHONE_ACCOUNT_ID,
            )
            val selection = if (sinceTimestamp > 0) "${CallLog.Calls.DATE} > ?" else null
            val selArgs   = if (sinceTimestamp > 0) arrayOf(sinceTimestamp.toString()) else null

            ctx.contentResolver.query(
                CallLog.Calls.CONTENT_URI, projection, selection, selArgs,
                "${CallLog.Calls.DATE} DESC LIMIT 200",
            )?.use { cursor ->
                val numberIdx   = cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER)
                val nameIdx     = cursor.getColumnIndexOrThrow(CallLog.Calls.CACHED_NAME)
                val typeIdx     = cursor.getColumnIndexOrThrow(CallLog.Calls.TYPE)
                val durIdx      = cursor.getColumnIndexOrThrow(CallLog.Calls.DURATION)
                val dateIdx     = cursor.getColumnIndexOrThrow(CallLog.Calls.DATE)

                while (cursor.moveToNext()) {
                    val callType = when (cursor.getInt(typeIdx)) {
                        CallLog.Calls.INCOMING_TYPE  -> "incoming"
                        CallLog.Calls.OUTGOING_TYPE  -> "outgoing"
                        CallLog.Calls.MISSED_TYPE    -> "missed"
                        CallLog.Calls.REJECTED_TYPE  -> "rejected"
                        else                         -> "missed"
                    }
                    result.put(JSONObject().apply {
                        put("id",        UUID.randomUUID().toString())
                        put("number",    cursor.getString(numberIdx) ?: "")
                        put("name",      cursor.getString(nameIdx))
                        put("type",      callType)
                        put("duration",  cursor.getInt(durIdx))
                        put("timestamp", cursor.getLong(dateIdx))
                    })
                }
            }
        } catch (_: Exception) {}
        return result.toString()
    }
}
