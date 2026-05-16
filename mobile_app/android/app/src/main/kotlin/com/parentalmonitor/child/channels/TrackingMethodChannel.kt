package com.parentalmonitor.child.channels

import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import com.parentalmonitor.child.services.AppUsageService
import com.parentalmonitor.child.services.BrowsingHistoryService
import com.parentalmonitor.child.services.CallLogService
import com.parentalmonitor.child.services.ContactsService
import com.parentalmonitor.child.services.DeviceService
import com.parentalmonitor.child.services.GalleryService
import com.parentalmonitor.child.services.LocationService
import com.parentalmonitor.child.services.RemoteCommandService
import com.parentalmonitor.child.services.TrackingForegroundService
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import org.json.JSONArray

/**
 * Five MethodChannels bridging Flutter → native Android services.
 *
 * com.parentalmonitor/tracking    — foreground service lifecycle
 * com.parentalmonitor/location    — GPS location reads
 * com.parentalmonitor/usage       — UsageStatsManager
 * com.parentalmonitor/device      — battery + device info + settings
 * com.parentalmonitor/monitoring  — call logs, contacts, gallery, browsing, geofences, app blocks
 */
class TrackingMethodChannel(
    private val ctx: Context,
    private val messenger: BinaryMessenger,
) {
    private val locationSvc = LocationService(ctx)
    private val usageSvc    = AppUsageService(ctx)
    private val deviceSvc   = DeviceService(ctx)
    private val callLogSvc  = CallLogService(ctx)
    private val contactsSvc = ContactsService(ctx)
    private val gallerySvc  = GalleryService(ctx)
    private val browsingSvc = BrowsingHistoryService(ctx)

    private var trackingCh:   MethodChannel? = null
    private var locationCh:   MethodChannel? = null
    private var usageCh:      MethodChannel? = null
    private var deviceCh:     MethodChannel? = null
    private var monitoringCh: MethodChannel? = null

    fun register() {
        trackingCh   = MethodChannel(messenger, CH_TRACKING).also   { it.setMethodCallHandler(::onTracking) }
        locationCh   = MethodChannel(messenger, CH_LOCATION).also   { it.setMethodCallHandler(::onLocation) }
        usageCh      = MethodChannel(messenger, CH_USAGE).also      { it.setMethodCallHandler(::onUsage) }
        deviceCh     = MethodChannel(messenger, CH_DEVICE).also     { it.setMethodCallHandler(::onDevice) }
        monitoringCh = MethodChannel(messenger, CH_MONITORING).also { it.setMethodCallHandler(::onMonitoring) }
    }

    fun unregister() {
        listOf(trackingCh, locationCh, usageCh, deviceCh, monitoringCh)
            .forEach { it?.setMethodCallHandler(null) }
    }

    // ── Tracking ──────────────────────────────────────────────────────────────

    private fun onTracking(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "startTrackingService" -> { startForeground(); result.success(true) }
            "stopTrackingService"  -> { stopForeground();  result.success(true) }
            "isTrackingActive"     -> result.success(TrackingForegroundService.isRunning)
            else                   -> result.notImplemented()
        }
    }

    // ── Location ──────────────────────────────────────────────────────────────

    private fun onLocation(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "getLocation" -> locationSvc.getLastLocation { json -> result.success(json) }
            else          -> result.notImplemented()
        }
    }

    // ── Usage ─────────────────────────────────────────────────────────────────

    private fun onUsage(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "getUsageStats" -> {
                val from = call.argument<Long>("from") ?: 0L
                val to   = call.argument<Long>("to")   ?: System.currentTimeMillis()
                result.success(usageSvc.getUsageStats(from, to))
            }
            "getInstalledApps"       -> result.success(usageSvc.getInstalledApps())
            "hasUsagePermission"     -> result.success(usageSvc.hasUsagePermission())
            "requestUsagePermission" -> { usageSvc.openUsageSettings(); result.success(null) }
            else                     -> result.notImplemented()
        }
    }

    // ── Device ────────────────────────────────────────────────────────────────

    private fun onDevice(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "getBatteryStatus" -> result.success(deviceSvc.getBatteryJson())
            "getDeviceInfo"    -> result.success(deviceSvc.getDeviceInfoJson())
            "openNotificationSettings" -> {
                ctx.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                result.success(null)
            }
            "isNotificationAccessGranted" -> {
                val flat = Settings.Secure.getString(ctx.contentResolver, "enabled_notification_listeners") ?: ""
                result.success(flat.contains(ctx.packageName))
            }
            "openBatterySettings" -> {
                ctx.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                result.success(null)
            }
            else -> result.notImplemented()
        }
    }

    // ── Monitoring (new data types) ───────────────────────────────────────────

    private fun onMonitoring(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "getCallLogs" -> {
                val since = call.argument<Long>("sinceTimestamp") ?: 0L
                result.success(callLogSvc.getCallLogs(since))
            }
            "getContacts" -> result.success(contactsSvc.getContacts())
            "getGalleryItems" -> {
                val since = call.argument<Long>("sinceTimestamp") ?: 0L
                result.success(gallerySvc.getGalleryItems(since))
            }
            "getBrowsingHistory" -> {
                val since = call.argument<Long>("sinceTimestamp") ?: 0L
                result.success(browsingSvc.getBrowsingHistory(since))
            }
            "updateBlockedApps" -> {
                val packages = call.argument<List<String>>("packages") ?: emptyList()
                ctx.getSharedPreferences(RemoteCommandService.PREFS_COMMANDS, Context.MODE_PRIVATE)
                    .edit()
                    .putString(RemoteCommandService.KEY_BLOCKED_APPS, JSONArray(packages).toString())
                    .apply()
                result.success(null)
            }
            "getStoredGeofences" -> {
                val raw = ctx.getSharedPreferences(RemoteCommandService.PREFS_COMMANDS, Context.MODE_PRIVATE)
                    .getString(RemoteCommandService.KEY_GEOFENCES, "[]") ?: "[]"
                result.success(raw)
            }
            else -> result.notImplemented()
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun startForeground() {
        val intent = Intent(ctx, TrackingForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(intent)
        else ctx.startService(intent)
    }

    private fun stopForeground() {
        ctx.stopService(Intent(ctx, TrackingForegroundService::class.java))
    }

    companion object {
        const val CH_TRACKING   = "com.parentalmonitor/tracking"
        const val CH_LOCATION   = "com.parentalmonitor/location"
        const val CH_USAGE      = "com.parentalmonitor/usage"
        const val CH_DEVICE     = "com.parentalmonitor/device"
        const val CH_MONITORING = "com.parentalmonitor/monitoring"
    }
}
