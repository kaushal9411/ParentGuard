package com.parentalmonitor.child.services

import android.content.Context
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

class BrowsingHistoryService(private val ctx: Context) {

    // Chromium-based: Chrome, Brave, Edge, Kiwi, Vivaldi, Opera, AOSP Browser
    private val CHROMIUM = listOf(
        "com.android.chrome"       to "content://com.android.chrome.browser/bookmarks",
        "com.chrome.beta"          to "content://com.chrome.beta.browser/bookmarks",
        "com.chrome.dev"           to "content://com.chrome.dev.browser/bookmarks",
        "com.chrome.canary"        to "content://com.chrome.canary.browser/bookmarks",
        "com.brave.browser"        to "content://com.brave.browser.browser/bookmarks",
        "com.microsoft.emmx"       to "content://com.microsoft.emmx.browser/bookmarks",
        "com.kiwibrowser.browser"  to "content://com.kiwibrowser.browser.browser/bookmarks",
        "com.vivaldi.browser"      to "content://com.vivaldi.browser.browser/bookmarks",
        "com.opera.browser"        to "content://com.opera.browser/bookmarks",
        "com.opera.mini.native"    to "content://com.opera.mini.native/bookmarks",
        "com.android.browser"      to "content://browser/bookmarks",
    )

    // Gecko-based: Firefox, Firefox Beta, Fenix
    private val GECKO = listOf(
        "org.mozilla.firefox"       to "content://org.mozilla.firefox.db.browser/history",
        "org.mozilla.firefox_beta"  to "content://org.mozilla.firefox_beta.db.browser/history",
        "org.mozilla.fenix"         to "content://org.mozilla.fenix.db.browser/history",
        "org.mozilla.fennec_aurora" to "content://org.mozilla.fennec_aurora.db.browser/history",
    )

    // Samsung Internet
    private val SAMSUNG = "com.sec.android.app.sbrowser" to
            "content://com.sec.android.app.sbrowser/history"

    fun getBrowsingHistory(sinceTimestamp: Long = 0L): String {
        val result = JSONArray()

        // First: real-time URLs captured by AccessibilityMonitorService
        drainQueue(sinceTimestamp, result)

        // Then: content providers from each installed browser
        for ((pkg, uri) in CHROMIUM) {
            if (result.length() >= MAX_TOTAL || !isInstalled(pkg)) continue
            queryChromium(uri, sinceTimestamp, pkg, result)
        }
        for ((pkg, uri) in GECKO) {
            if (result.length() >= MAX_TOTAL || !isInstalled(pkg)) continue
            queryGecko(uri, sinceTimestamp, pkg, result)
        }
        val (samsungPkg, samsungUri) = SAMSUNG
        if (isInstalled(samsungPkg)) querySamsung(samsungUri, sinceTimestamp, samsungPkg, result)

        return result.toString()
    }

    private fun drainQueue(since: Long, out: JSONArray) {
        try {
            val prefs = ctx.getSharedPreferences(QUEUE_PREFS, Context.MODE_PRIVATE)
            val arr   = parseArray(prefs.getString(QUEUE_KEY, "[]") ?: "[]")
            for (i in 0 until arr.length()) {
                if (out.length() >= MAX_TOTAL) break
                val e  = arr.optJSONObject(i) ?: continue
                val ts = e.optLong("visitedAt", 0)
                if (since <= 0 || ts > since) out.put(e)
            }
            prefs.edit().putString(QUEUE_KEY, "[]").apply()
        } catch (_: Exception) {}
    }

    private fun queryChromium(uriStr: String, since: Long, pkg: String, out: JSONArray) {
        try {
            val sel = "bookmark = 0" + if (since > 0) " AND date > $since" else ""
            ctx.contentResolver.query(
                Uri.parse(uriStr),
                arrayOf("url", "title", "date"),
                sel, null, "date DESC",
            )?.use { c ->
                val uIdx = c.getColumnIndex("url")
                val tIdx = c.getColumnIndex("title")
                val dIdx = c.getColumnIndex("date")
                if (uIdx < 0 || dIdx < 0) return
                var n = 0
                while (c.moveToNext() && n < PER_SOURCE && out.length() < MAX_TOTAL) {
                    val url = c.getString(uIdx)?.takeIf { it.isNotBlank() } ?: continue
                    out.put(entry(url, c.getString(tIdx), c.getLong(dIdx), pkg, 1))
                    n++
                }
            }
        } catch (_: Exception) {}
    }

    private fun queryGecko(uriStr: String, since: Long, pkg: String, out: JSONArray) {
        try {
            val sel = if (since > 0) "date_last_visited > $since" else null
            ctx.contentResolver.query(
                Uri.parse(uriStr),
                arrayOf("url", "title", "date_last_visited", "visits"),
                sel, null, "date_last_visited DESC",
            )?.use { c ->
                val uIdx = c.getColumnIndex("url")
                val tIdx = c.getColumnIndex("title")
                val dIdx = c.getColumnIndex("date_last_visited")
                val vIdx = c.getColumnIndex("visits")
                if (uIdx < 0 || dIdx < 0) return
                var n = 0
                while (c.moveToNext() && n < PER_SOURCE && out.length() < MAX_TOTAL) {
                    val url = c.getString(uIdx)?.takeIf { it.isNotBlank() } ?: continue
                    out.put(entry(url, c.getString(tIdx), c.getLong(dIdx), pkg,
                        if (vIdx >= 0) c.getInt(vIdx) else 1))
                    n++
                }
            }
        } catch (_: Exception) {}
    }

    private fun querySamsung(uriStr: String, since: Long, pkg: String, out: JSONArray) {
        try {
            ctx.contentResolver.query(
                Uri.parse(uriStr), null,
                if (since > 0) "visitTime > $since" else null,
                null, "visitTime DESC",
            )?.use { c ->
                // Samsung uses different column names depending on version
                val uIdx = maxOf(c.getColumnIndex("url"), c.getColumnIndex("URL"))
                val tIdx = maxOf(c.getColumnIndex("title"), c.getColumnIndex("TITLE"))
                val dIdx = maxOf(
                    c.getColumnIndex("visitTime"),
                    c.getColumnIndex("date"),
                    c.getColumnIndex("DATE"),
                )
                if (uIdx < 0 || dIdx < 0) return
                var n = 0
                while (c.moveToNext() && n < PER_SOURCE && out.length() < MAX_TOTAL) {
                    val url = c.getString(uIdx)?.takeIf { it.isNotBlank() } ?: continue
                    out.put(entry(url, if (tIdx >= 0) c.getString(tIdx) else null,
                        c.getLong(dIdx), pkg, 1))
                    n++
                }
            }
        } catch (_: Exception) {}
    }

    private fun entry(url: String, title: String?, ts: Long, pkg: String, visits: Int) =
        JSONObject().apply {
            put("id",         UUID.randomUUID().toString())
            put("url",        url)
            put("title",      title ?: JSONObject.NULL)
            put("visitedAt",  ts)
            put("browserApp", pkg)
            put("visitCount", visits)
        }

    private fun parseArray(json: String) = try { JSONArray(json) } catch (_: Exception) { JSONArray() }

    private fun isInstalled(pkg: String) = try {
        ctx.packageManager.getPackageInfo(pkg, 0); true
    } catch (_: Exception) { false }

    companion object {
        const val QUEUE_PREFS = "pm_browsing_queue"
        const val QUEUE_KEY   = "url_entries"
        const val MAX_QUEUE   = 2000
        private const val PER_SOURCE = 500
        private const val MAX_TOTAL  = 1000
    }
}
