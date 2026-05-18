package com.parentalmonitor.child.services

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.os.Build
import android.view.accessibility.AccessibilityEvent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/**
 * Accessibility service with three roles:
 *
 * 1. Foreground app detection
 * 2. App blocking (navigate home when blocked app opens)
 * 3. Browser URL capture — polls the address bar every 3 s while any browser
 *    is in the foreground, which catches in-tab link navigation that does NOT
 *    fire TYPE_WINDOW_STATE_CHANGED.
 */
class AccessibilityMonitorService : AccessibilityService() {

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var pollJob: Job? = null

    private var lastForegroundPackage = ""
    private var lastCapturedUrl       = ""
    private var lastCapturedPkg       = ""

    override fun onServiceConnected() {
        serviceInfo = AccessibilityServiceInfo().apply {
            eventTypes          = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            feedbackType        = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags               = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or
                                  AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
            notificationTimeout = 100
        }
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    override fun onInterrupt() = Unit

    // ── Main event handler ────────────────────────────────────────────────────

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return

        // App blocking
        if (isBlocked(pkg)) {
            performGlobalAction(GLOBAL_ACTION_HOME)
            return
        }

        // Foreground tracking
        if (pkg != lastForegroundPackage) {
            lastForegroundPackage = pkg
            persistForegroundApp(pkg)
        }

        // Start/stop URL polling based on whether we're in a browser
        if (pkg in BROWSER_PACKAGES) {
            startPolling(pkg)
        } else {
            stopPolling()
        }
    }

    // ── URL polling ───────────────────────────────────────────────────────────

    private fun startPolling(pkg: String) {
        if (pollJob?.isActive == true && lastCapturedPkg == pkg) return // already polling this browser
        pollJob?.cancel()
        pollJob = scope.launch {
            while (isActive) {
                if (lastForegroundPackage !in BROWSER_PACKAGES) break
                readUrlBar(lastForegroundPackage)
                delay(POLL_INTERVAL_MS)
            }
        }
    }

    private fun stopPolling() {
        pollJob?.cancel()
        pollJob = null
    }

    private fun readUrlBar(pkg: String) {
        val viewId = URL_BAR_IDS[pkg] ?: return
        try {
            val nodes = findNodes(viewId)
            for (node in nodes) {
                val raw = node.text?.toString()?.trim() ?: continue
                if (!isUrl(raw)) continue

                val url = if (raw.startsWith("http")) raw else "https://$raw"
                if (url == lastCapturedUrl && pkg == lastCapturedPkg) break

                lastCapturedUrl = url
                lastCapturedPkg = pkg
                enqueue(url, pkg)
                break
            }
        } catch (_: Exception) {}
    }

    /** Try rootInActiveWindow first; fall back to scanning all windows. */
    private fun findNodes(viewId: String): List<android.view.accessibility.AccessibilityNodeInfo> {
        rootInActiveWindow?.findAccessibilityNodeInfosByViewId(viewId)
            ?.takeIf { it.isNotEmpty() }
            ?.let { return it }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            for (window in (windows ?: emptyList())) {
                val root = window.root ?: continue
                val found = root.findAccessibilityNodeInfosByViewId(viewId)
                if (found.isNotEmpty()) return found
            }
        }
        return emptyList()
    }

    private fun isUrl(text: String) =
        text.startsWith("http://") || text.startsWith("https://") ||
        (text.contains(".") && !text.contains(" ") && text.length > 4)

    private fun enqueue(url: String, pkg: String) {
        try {
            val prefs = getSharedPreferences(BrowsingHistoryService.QUEUE_PREFS, Context.MODE_PRIVATE)
            val json  = prefs.getString(BrowsingHistoryService.QUEUE_KEY, "[]") ?: "[]"
            val arr   = try { JSONArray(json) } catch (_: Exception) { JSONArray() }

            arr.put(JSONObject().apply {
                put("id",         UUID.randomUUID().toString())
                put("url",        url)
                put("title",      JSONObject.NULL)
                put("visitedAt",  System.currentTimeMillis())
                put("browserApp", pkg)
                put("visitCount", 1)
            })

            val trimmed = if (arr.length() > BrowsingHistoryService.MAX_QUEUE) {
                val start = arr.length() - BrowsingHistoryService.MAX_QUEUE
                JSONArray((start until arr.length()).map { arr.get(it) })
            } else arr

            prefs.edit().putString(BrowsingHistoryService.QUEUE_KEY, trimmed.toString()).apply()
        } catch (_: Exception) {}
    }

    // ── App blocking & foreground tracking ────────────────────────────────────

    private fun isBlocked(pkg: String): Boolean {
        val raw = getSharedPreferences(RemoteCommandService.PREFS_COMMANDS, Context.MODE_PRIVATE)
            .getString(RemoteCommandService.KEY_BLOCKED_APPS, "[]") ?: "[]"
        return try {
            val arr = JSONArray(raw)
            (0 until arr.length()).any { arr.getString(it) == pkg }
        } catch (_: Exception) { false }
    }

    private fun persistForegroundApp(pkg: String) {
        getSharedPreferences("pm_accessibility", Context.MODE_PRIVATE).edit()
            .putString("foreground_package", pkg)
            .putLong("foreground_since", System.currentTimeMillis())
            .apply()
    }

    // ── Constants ─────────────────────────────────────────────────────────────

    companion object {
        private const val POLL_INTERVAL_MS = 3_000L

        val BROWSER_PACKAGES = setOf(
            "com.android.chrome", "com.chrome.beta", "com.chrome.dev", "com.chrome.canary",
            "org.mozilla.firefox", "org.mozilla.firefox_beta",
            "org.mozilla.fenix", "org.mozilla.fennec_aurora",
            "com.brave.browser", "com.microsoft.emmx",
            "com.opera.browser", "com.opera.mini.native",
            "com.sec.android.app.sbrowser",
            "com.duckduckgo.mobile.android",
            "com.kiwibrowser.browser",
            "com.vivaldi.browser",
        )

        private val URL_BAR_IDS = mapOf(
            "com.android.chrome"            to "com.android.chrome:id/url_bar",
            "com.chrome.beta"               to "com.chrome.beta:id/url_bar",
            "com.chrome.dev"                to "com.chrome.dev:id/url_bar",
            "com.chrome.canary"             to "com.chrome.canary:id/url_bar",
            "com.brave.browser"             to "com.brave.browser:id/url_bar",
            "com.microsoft.emmx"            to "com.microsoft.emmx:id/url_bar",
            "com.kiwibrowser.browser"       to "com.kiwibrowser.browser:id/url_bar",
            "com.vivaldi.browser"           to "com.vivaldi.browser:id/url_bar",
            "org.mozilla.firefox"           to "org.mozilla.firefox:id/mozac_browser_toolbar_url_view",
            "org.mozilla.firefox_beta"      to "org.mozilla.firefox_beta:id/mozac_browser_toolbar_url_view",
            "org.mozilla.fenix"             to "org.mozilla.fenix:id/mozac_browser_toolbar_url_view",
            "org.mozilla.fennec_aurora"     to "org.mozilla.fennec_aurora:id/mozac_browser_toolbar_url_view",
            "com.sec.android.app.sbrowser"  to "com.sec.android.app.sbrowser:id/location_bar_edit_text",
            "com.duckduckgo.mobile.android" to "com.duckduckgo.mobile.android:id/omnibarTextInput",
            "com.opera.browser"             to "com.opera.browser:id/url_field",
        )
    }
}
