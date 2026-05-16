package com.parentalmonitor.child.services

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.view.accessibility.AccessibilityEvent

/**
 * Optional accessibility service.
 *
 * Default state: DISABLED in AndroidManifest (android:enabled="false").
 * Enable only if you need foreground-app tracking on API < 21 or
 * as a fallback when UsageStatsManager permission is not granted.
 *
 * Capability provided: detect foreground app changes via
 * TYPE_WINDOW_STATE_CHANGED — useful for devices that block UsageStats.
 *
 * Privacy note: this service is intentionally minimal. It does NOT
 * read screen content (canRetrieveWindowContent = false).
 */
class AccessibilityMonitorService : AccessibilityService() {

    private var lastForegroundPackage = ""

    override fun onServiceConnected() {
        serviceInfo = AccessibilityServiceInfo().apply {
            eventTypes    = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            feedbackType  = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags         = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
            notificationTimeout = 100
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return

        val pkg = event.packageName?.toString() ?: return
        if (pkg == lastForegroundPackage) return  // skip duplicates

        lastForegroundPackage = pkg
        persistForegroundApp(pkg)
    }

    override fun onInterrupt() = Unit

    private fun persistForegroundApp(packageName: String) {
        getSharedPreferences("pm_accessibility", Context.MODE_PRIVATE)
            .edit()
            .putString("foreground_package", packageName)
            .putLong("foreground_since", System.currentTimeMillis())
            .apply()
    }
}
