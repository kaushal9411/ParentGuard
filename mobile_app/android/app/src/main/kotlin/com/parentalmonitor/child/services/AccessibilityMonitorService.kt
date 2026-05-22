package com.parentalmonitor.child.services

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.os.Build
import android.util.Base64
import android.view.Display
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
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
import java.io.ByteArrayOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

/**
 * Accessibility service with three roles:
 *
 * 1. Foreground app detection
 * 2. App blocking — navigates home when a blocked package opens
 * 3. Browser URL capture — three complementary layers:
 *
 *    Layer A (works without canRetrieveWindowContent):
 *      - TYPE_VIEW_TEXT_CHANGED on URL bar node → event.source.text contains the URL
 *      - TYPE_WINDOW_STATE_CHANGED event.text → Chrome sometimes puts URL there
 *
 *    Layer B (requires canRetrieveWindowContent=true, active after re-toggle):
 *      - Coroutine polling every 3 s via rootInActiveWindow / getWindows()
 *      - Full tree traversal fallback
 */
class AccessibilityMonitorService : AccessibilityService() {

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var pollJob: Job? = null

    private val iso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    private var lastForegroundPkg  = ""
    private var lastCapturedUrl    = ""
    private var lastCapturedPkg    = ""
    private var lastTextEventMs    = 0L   // throttle TYPE_VIEW_TEXT_CHANGED

    // ── Lifecycle ──────────────────────────────────────────────────────────────

    override fun onServiceConnected() {
        instance = this
        serviceInfo = AccessibilityServiceInfo().apply {
            // TYPE_VIEW_TEXT_CHANGED fires on the URL-bar node when the browser
            // auto-updates it after navigation — readable without canRetrieveWindowContent.
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or
                         AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED
            feedbackType        = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags               = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or
                                  AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
            notificationTimeout = 50
        }
    }

    override fun onDestroy() {
        instance = null
        scope.cancel()
        super.onDestroy()
    }

    override fun onInterrupt() = Unit

    // ── Screenshot (API 30+) ──────────────────────────────────────────────────

    @SuppressLint("NewApi")
    fun captureScreenshot() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            screenshotCallback?.invoke("""{"type":"error","message":"screenshot requires Android 11+"}""")
            return
        }
        takeScreenshot(Display.DEFAULT_DISPLAY, mainExecutor,
            object : TakeScreenshotCallback {
                override fun onSuccess(result: ScreenshotResult) {
                    try {
                        val bmp = Bitmap.wrapHardwareBuffer(result.hardwareBuffer, result.colorSpace)
                        result.hardwareBuffer.close()
                        if (bmp == null) {
                            screenshotCallback?.invoke("""{"type":"error","message":"null bitmap"}""")
                            return
                        }
                        val soft = bmp.copy(Bitmap.Config.ARGB_8888, false)
                        val w = soft.width; val h = soft.height
                        bmp.recycle()
                        val bos = ByteArrayOutputStream()
                        soft.compress(Bitmap.CompressFormat.JPEG, 80, bos)
                        soft.recycle()
                        val b64 = Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP)
                        screenshotCallback?.invoke(
                            JSONObject().apply {
                                put("type",     "screenshot")
                                put("data",     b64)
                                put("mimeType", "image/jpeg")
                                put("width",    w)
                                put("height",   h)
                            }.toString()
                        )
                    } catch (e: Exception) {
                        screenshotCallback?.invoke("""{"type":"error","message":"${e.message}"}""")
                    }
                }
                override fun onFailure(code: Int) {
                    screenshotCallback?.invoke("""{"type":"error","message":"screenshot failed code $code"}""")
                }
            }
        )
    }

    // ── Main event dispatch ────────────────────────────────────────────────────

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val pkg = event.packageName?.toString() ?: return

        when (event.eventType) {

            // ── Window focus changed (app switch / new page in same tab) ───────
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                if (isBlocked(pkg)) {
                    performGlobalAction(GLOBAL_ACTION_HOME)
                    return
                }
                if (pkg != lastForegroundPkg) {
                    lastForegroundPkg = pkg
                    persistForegroundPkg(pkg)
                }
                if (pkg in BROWSER_PACKAGES) {
                    // Layer A: the event.text list sometimes contains the URL
                    tryUrlFromEventText(event, pkg)
                    // Layer B: start polling (works when canRetrieveWindowContent=true)
                    startPolling(pkg)
                } else {
                    stopPolling()
                }
            }

            // ── URL-bar text changed (browser auto-updates after navigation) ───
            AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED -> {
                if (pkg !in BROWSER_PACKAGES) return
                // Throttle to max once per second to avoid typing noise
                val now = System.currentTimeMillis()
                if (now - lastTextEventMs < 1_000L) return
                lastTextEventMs = now
                tryUrlFromEventSource(event, pkg)
            }
        }
    }

    // ── Layer A: read URL from event itself (no tree traversal needed) ─────────

    private fun tryUrlFromEventText(event: AccessibilityEvent, pkg: String) {
        event.text.forEach { cs ->
            val t = cs?.toString()?.trim() ?: return@forEach
            if (t.startsWith("http://") || t.startsWith("https://")) {
                captureIfNew(t, pkg)
                return
            }
        }
    }

    private fun tryUrlFromEventSource(event: AccessibilityEvent, pkg: String) {
        val source = event.source ?: return
        try {
            // Only act if it looks like a URL-bar node
            val viewId = source.viewIdResourceName ?: ""
            val isUrlBar = URL_BAR_IDS[pkg]?.endsWith(viewId.substringAfterLast("/")) == true ||
                           URL_BAR_KEYWORDS.any { viewId.contains(it, ignoreCase = true) }
            if (!isUrlBar) return

            val text = source.text?.toString()?.trim() ?: return
            val url = when {
                text.startsWith("http://") || text.startsWith("https://") -> text
                text.contains(".") && !text.contains(" ") && text.length > 4 -> "https://$text"
                else -> return
            }
            captureIfNew(url, pkg)
        } finally {
            source.recycle()
        }
    }

    // ── Layer B: coroutine polling (requires canRetrieveWindowContent=true) ────

    private fun startPolling(pkg: String) {
        if (pollJob?.isActive == true) return  // already running
        pollJob = scope.launch {
            while (isActive) {
                if (lastForegroundPkg !in BROWSER_PACKAGES) break
                readUrlViaTree(lastForegroundPkg)
                delay(POLL_MS)
            }
        }
    }

    private fun stopPolling() {
        pollJob?.cancel()
        pollJob = null
    }

    private fun readUrlViaTree(pkg: String) {
        val viewId = URL_BAR_IDS[pkg] ?: return
        try {
            val root = rootInActiveWindow
                ?: (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP)
                        (windows ?: emptyList()).firstNotNullOfOrNull { w -> w.root }
                    else null)
                ?: return

            var found: String? = null

            // Try by resource ID first
            root.findAccessibilityNodeInfosByViewId(viewId)
                .firstOrNull { isUrl(it.text?.toString()?.trim() ?: "") }
                ?.let { found = it.text.toString().trim() }

            // Fallback: depth-limited tree walk
            if (found == null) found = findUrlInTree(root, 0)

            root.recycle()
            found?.let {
                captureIfNew(if (it.startsWith("http")) it else "https://$it", pkg)
            }
        } catch (_: Exception) {}
    }

    private fun findUrlInTree(node: AccessibilityNodeInfo, depth: Int): String? {
        if (depth > 8) return null
        listOf(node.text, node.contentDescription).forEach { cs ->
            val t = cs?.toString()?.trim() ?: return@forEach
            if (t.startsWith("https://") || t.startsWith("http://")) return t
        }
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val r = findUrlInTree(child, depth + 1)
            child.recycle()
            if (r != null) return r
        }
        return null
    }

    // ── Capture & queue ───────────────────────────────────────────────────────

    private fun captureIfNew(url: String, pkg: String) {
        if (url == lastCapturedUrl && pkg == lastCapturedPkg) return
        lastCapturedUrl = url
        lastCapturedPkg = pkg
        enqueue(url, pkg)
    }

    private fun enqueue(url: String, pkg: String) {
        try {
            val prefs = getSharedPreferences(BrowsingHistoryService.QUEUE_PREFS, Context.MODE_PRIVATE)
            val json  = prefs.getString(BrowsingHistoryService.QUEUE_KEY, "[]") ?: "[]"
            val arr   = try { JSONArray(json) } catch (_: Exception) { JSONArray() }

            val nowMs = System.currentTimeMillis()
            arr.put(JSONObject().apply {
                put("id",          UUID.randomUUID().toString())
                put("url",         url)
                put("title",       JSONObject.NULL)
                put("visitedAt",   iso.format(Date(nowMs)))
                put("visitedAtMs", nowMs)
                put("browserApp",  pkg)
                put("visitCount",  1)
            })

            val trimmed = if (arr.length() > BrowsingHistoryService.MAX_QUEUE) {
                val start = arr.length() - BrowsingHistoryService.MAX_QUEUE
                JSONArray((start until arr.length()).map { arr.get(it) })
            } else arr

            prefs.edit().putString(BrowsingHistoryService.QUEUE_KEY, trimmed.toString()).apply()
        } catch (_: Exception) {}
    }

    // ── App blocking & foreground tracking ────────────────────────────────────

    private fun isUrl(text: String) =
        text.startsWith("http://") || text.startsWith("https://") ||
        (text.contains(".") && !text.contains(" ") && text.length > 4)

    private fun isBlocked(pkg: String): Boolean {
        val raw = getSharedPreferences(RemoteCommandService.PREFS_COMMANDS, Context.MODE_PRIVATE)
            .getString(RemoteCommandService.KEY_BLOCKED_APPS, "[]") ?: "[]"
        return try {
            val arr = JSONArray(raw)
            (0 until arr.length()).any { arr.getString(it) == pkg }
        } catch (_: Exception) { false }
    }

    private fun persistForegroundPkg(pkg: String) {
        getSharedPreferences("pm_accessibility", Context.MODE_PRIVATE).edit()
            .putString("foreground_package", pkg)
            .putLong("foreground_since", System.currentTimeMillis())
            .apply()
    }

    // ── Constants ─────────────────────────────────────────────────────────────

    companion object {
        private const val POLL_MS = 3_000L

        /** Set by RemoteCommandService before triggering screenshot; called with result JSON. */
        @Volatile var screenshotCallback: ((String) -> Unit)? = null

        /** Singleton reference so RemoteCommandService can trigger a screenshot. */
        @Volatile var instance: AccessibilityMonitorService? = null

        private val URL_BAR_KEYWORDS = listOf("url_bar", "location_bar", "address_bar",
            "omnibar", "url_field", "location_edit", "mozac_browser_toolbar")

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

        val URL_BAR_IDS = mapOf(
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
