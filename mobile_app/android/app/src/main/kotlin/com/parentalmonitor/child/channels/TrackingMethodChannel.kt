package com.parentalmonitor.child.channels

import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import com.parentalmonitor.child.listeners.NotificationMonitorService
import com.parentalmonitor.child.services.AppUsageService
import com.parentalmonitor.child.services.DeviceService
import com.parentalmonitor.child.services.LocationService
import com.parentalmonitor.child.services.TrackingForegroundService
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * Registers all four MethodChannels and routes calls to the appropriate
 * native service.
 *
 * Channel → Methods
 * ─────────────────────────────────────────────────────────────────
 * com.parentalmonitor/tracking → startTrackingService, stopTrackingService,
 *                                isTrackingActive
 * com.parentalmonitor/location → getLocation
 * com.parentalmonitor/usage    → getUsageStats, getInstalledApps,
 *                                hasUsagePermission, requestUsagePermission
 * com.parentalmonitor/device   → getBatteryStatus, getDeviceInfo,
 *                                openNotificationSettings,
 *                                isNotificationAccessGranted,
 *                                openBatterySettings
 */
class TrackingMethodChannel(
    private val ctx: Context,
    private val messenger: BinaryMessenger,
) {
    private val locationSvc = LocationService(ctx)
    private val usageSvc    = AppUsageService(ctx)
    private val deviceSvc   = DeviceService(ctx)

    private var trackingCh: MethodChannel? = null
    private var locationCh: MethodChannel? = null
    private var usageCh:    MethodChannel? = null
    private var deviceCh:   MethodChannel? = null

    fun register() {
        trackingCh = MethodChannel(messenger, CH_TRACKING).also {
            it.setMethodCallHandler(::onTracking)
        }
        locationCh = MethodChannel(messenger, CH_LOCATION).also {
            it.setMethodCallHandler(::onLocation)
        }
        usageCh = MethodChannel(messenger, CH_USAGE).also {
            it.setMethodCallHandler(::onUsage)
        }
        deviceCh = MethodChannel(messenger, CH_DEVICE).also {
            it.setMethodCallHandler(::onDevice)
        }
    }

    fun unregister() {
        trackingCh?.setMethodCallHandler(null)
        locationCh?.setMethodCallHandler(null)
        usageCh?.setMethodCallHandler(null)
        deviceCh?.setMethodCallHandler(null)
    }

    // ── Tracking ──────────────────────────────────────────────────────────

    private fun onTracking(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "startTrackingService" -> { startForegroundService(); result.success(true) }
            "stopTrackingService"  -> { stopForegroundService();  result.success(true) }
            "isTrackingActive"     -> result.success(TrackingForegroundService.isRunning)
            else                   -> result.notImplemented()
        }
    }

    // ── Location ──────────────────────────────────────────────────────────

    private fun onLocation(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "getLocation" -> locationSvc.getLastLocation { json -> result.success(json) }
            else          -> result.notImplemented()
        }
    }

    // ── Usage ─────────────────────────────────────────────────────────────

    private fun onUsage(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "getUsageStats" -> {
                val from = call.argument<Long>("from") ?: 0L
                val to   = call.argument<Long>("to")   ?: System.currentTimeMillis()
                result.success(usageSvc.getUsageStats(from, to))
            }
            "getInstalledApps"        -> result.success(usageSvc.getInstalledApps())
            "hasUsagePermission"      -> result.success(usageSvc.hasUsagePermission())
            "requestUsagePermission"  -> { usageSvc.openUsageSettings(); result.success(null) }
            else                      -> result.notImplemented()
        }
    }

    // ── Device ────────────────────────────────────────────────────────────

    private fun onDevice(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "getBatteryStatus" -> result.success(deviceSvc.getBatteryJson())
            "getDeviceInfo"    -> result.success(deviceSvc.getDeviceInfoJson())

            "openNotificationSettings" -> {
                ctx.startActivity(
                    Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                )
                result.success(null)
            }

            "isNotificationAccessGranted" -> {
                val flat = Settings.Secure.getString(
                    ctx.contentResolver,
                    "enabled_notification_listeners"
                ) ?: ""
                result.success(flat.contains(ctx.packageName))
            }

            "openBatterySettings" -> {
                ctx.startActivity(
                    Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                )
                result.success(null)
            }

            else -> result.notImplemented()
        }
    }

    // ── Service helpers ───────────────────────────────────────────────────

    private fun startForegroundService() {
        val intent = Intent(ctx, TrackingForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(intent)
        } else {
            ctx.startService(intent)
        }
    }

    private fun stopForegroundService() {
        ctx.stopService(Intent(ctx, TrackingForegroundService::class.java))
    }

    companion object {
        const val CH_TRACKING = "com.parentalmonitor/tracking"
        const val CH_LOCATION = "com.parentalmonitor/location"
        const val CH_USAGE    = "com.parentalmonitor/usage"
        const val CH_DEVICE   = "com.parentalmonitor/device"
    }
}
