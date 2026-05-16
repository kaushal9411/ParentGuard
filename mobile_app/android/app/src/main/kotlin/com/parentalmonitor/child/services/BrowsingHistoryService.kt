package com.parentalmonitor.child.services

import android.content.Context
import android.database.Cursor
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

class BrowsingHistoryService(private val ctx: Context) {

    fun getBrowsingHistory(sinceTimestamp: Long = 0L): String {
        val result = JSONArray()
        // Try the standard Browser content provider (works on many Android OEM ROMs)
        tryBrowserProvider(sinceTimestamp, result)
        // Fallback: try Chrome's exposed history URI (requires same signature on some ROMs)
        if (result.length() == 0) tryChromeProvider(sinceTimestamp, result)
        return result.toString()
    }

    @Suppress("DEPRECATION")
    private fun tryBrowserProvider(since: Long, out: JSONArray) {
        try {
            val selection = buildString {
                append("bookmark = 0")
                if (since > 0) append(" AND date > $since")
            }
            ctx.contentResolver.query(
                Uri.parse("content://browser/bookmarks"),
                arrayOf("_id", "url", "title", "date"),
                selection, null, "date DESC",
            )?.use { c -> fillFromCursor(c, out, "com.android.browser") }
        } catch (_: Exception) {}
    }

    private fun tryChromeProvider(since: Long, out: JSONArray) {
        try {
            val selection = buildString {
                append("bookmark = 0")
                if (since > 0) append(" AND date > $since")
            }
            ctx.contentResolver.query(
                Uri.parse("content://com.android.chrome.browser/bookmarks"),
                arrayOf("_id", "url", "title", "date"),
                selection, null, "date DESC",
            )?.use { c -> fillFromCursor(c, out, "com.android.chrome") }
        } catch (_: Exception) {}
    }

    private fun fillFromCursor(c: Cursor, out: JSONArray, browserApp: String) {
        val urlIdx   = c.getColumnIndex("url")
        val titleIdx = c.getColumnIndex("title")
        val dateIdx  = c.getColumnIndex("date")
        if (urlIdx < 0 || dateIdx < 0) return

        while (c.moveToNext() && out.length() < 200) {
            val url = c.getString(urlIdx)?.takeIf { it.isNotBlank() } ?: continue
            out.put(JSONObject().apply {
                put("id",         UUID.randomUUID().toString())
                put("url",        url)
                put("title",      if (titleIdx >= 0) c.getString(titleIdx) else JSONObject.NULL)
                put("visitedAt",  c.getLong(dateIdx))
                put("browserApp", browserApp)
                put("visitCount", 1)
            })
        }
    }
}
