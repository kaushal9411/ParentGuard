package com.parentalmonitor.child.services

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.Intent
import android.view.accessibility.AccessibilityEvent
import org.json.JSONArray

/**
 * Accessibility service with two capabilities:
 *
 * 1. Foreground app detection — persists current package to SharedPreferences
 *    for UsageStats fallback on devices that block PACKAGE_USAGE_STATS.
 *
 * 2. App blocking — reads the blocked packages list from SharedPreferences
 *    and immediately navigates to the home screen if a blocked app opens.
 */
class AccessibilityMonitorService : AccessibilityService() {

    private var lastForegroundPackage = ""

    override fun onServiceConnected() {
        serviceInfo = AccessibilityServiceInfo().apply {
            eventTypes         = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            feedbackType       = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags              = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
            notificationTimeout = 100
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return

        // Enforce app block list
        if (isBlocked(pkg)) {
            performGlobalAction(GLOBAL_ACTION_HOME)
            return
        }

        if (pkg == lastForegroundPackage) return
        lastForegroundPackage = pkg
        persistForegroundApp(pkg)
    }

    override fun onInterrupt() = Unit

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun isBlocked(packageName: String): Boolean {
        val prefs   = getSharedPreferences(RemoteCommandService.PREFS_COMMANDS, Context.MODE_PRIVATE)
        val raw     = prefs.getString(RemoteCommandService.KEY_BLOCKED_APPS, "[]") ?: "[]"
        return try {
            val arr = JSONArray(raw)
            (0 until arr.length()).any { arr.getString(it) == packageName }
        } catch (_: Exception) { false }
    }

    private fun persistForegroundApp(packageName: String) {
        getSharedPreferences("pm_accessibility", Context.MODE_PRIVATE)
            .edit()
            .putString("foreground_package", packageName)
            .putLong("foreground_since", System.currentTimeMillis())
            .apply()
    }
}
