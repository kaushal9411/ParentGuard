package com.parentalmonitor.child

import android.content.ComponentName
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import com.parentalmonitor.child.BuildConfig
import com.parentalmonitor.child.channels.TrackingMethodChannel
import com.parentalmonitor.child.services.TrackingForegroundService
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {

    private lateinit var trackingChannel: TrackingMethodChannel

    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        // Secret dial-code re-entry: intentional reveal — clear stealth and open normally.
        if (intent?.getBooleanExtra(
                com.parentalmonitor.child.receivers.SecretCodeReceiver.EXTRA_FROM_SECRET_CODE, false) == true) {
            stealthPrefs().edit().putBoolean(KEY_STEALTH, false).apply()
            return
        }
        // On non-Samsung devices, if stealth mode is active (set by hideApp/remote command),
        // immediately close this activity — a tapped stale icon looks like nothing happened.
        // DEBUG builds skip this so flutter run / hot-reload always work.
        if (!BuildConfig.DEBUG && !isSamsungDevice() && stealthPrefs().getBoolean(KEY_STEALTH, false)) {
            finish()
            return
        }
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // In DEBUG mode always clear stealth so flutter run can reach the UI.
        if (BuildConfig.DEBUG) {
            stealthPrefs().edit().putBoolean(KEY_STEALTH, false).apply()
            showIcon()
        }
        trackingChannel = TrackingMethodChannel(
            this,
            flutterEngine.dartExecutor.binaryMessenger
        )
        trackingChannel.register()
        registerLauncherChannel(flutterEngine)
    }

    private fun registerLauncherChannel(flutterEngine: FlutterEngine) {
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "com.parental_monitor.app/launcher"
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "hideIcon"     -> result.success(hideIcon())
                "showIcon"     -> result.success(showIcon())
                "isIconHidden" -> result.success(isAppHidden())
                "hideApp"      -> {
                    sendStealthToService()
                    hideIcon()
                    startActivity(Intent(Intent.ACTION_MAIN).apply {
                        addCategory(Intent.CATEGORY_HOME)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    })
                    result.success(true)
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun hideIcon(): Boolean {
        return try {
            if (isSamsungDevice()) {
                // Samsung's launcher only responds to full package disable, not alias disable.
                // Re-enable every background component so they keep running while package is hidden.
                val pm = packageManager
                pm.setApplicationEnabledSetting(packageName,
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP)
                backgroundComponents().forEach { cls ->
                    try {
                        pm.setComponentEnabledSetting(ComponentName(this, cls),
                            PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP)
                    } catch (_: Exception) {}
                }
            } else {
                // Non-Samsung (Vivo/Oppo/Realme): their launchers cache icons and ignore
                // component-disable, so we CANNOT remove the icon — and disabling the alias only
                // causes a dead "App info on tap" icon. Instead the app is disguised as a generic
                // "System Service" gear. Hiding just sets the stealth flag: the disguised icon
                // stays, the notification goes silent, and tapping the icon closes instantly
                // (see onCreate). Parent re-enters via dial code *#*#94123#*#* or the dashboard.
                stealthPrefs().edit().putBoolean(KEY_STEALTH, true).apply()
            }
            true
        } catch (_: Exception) { false }
    }

    private fun showIcon(): Boolean {
        return try {
            stealthPrefs().edit().putBoolean(KEY_STEALTH, false).apply()
            val pm = packageManager
            if (isSamsungDevice()) {
                pm.setApplicationEnabledSetting(packageName,
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP)
                backgroundComponents().forEach { cls ->
                    try {
                        pm.setComponentEnabledSetting(ComponentName(this, cls),
                            PackageManager.COMPONENT_ENABLED_STATE_DEFAULT, PackageManager.DONT_KILL_APP)
                    } catch (_: Exception) {}
                }
            } else {
                // Re-enable alias in case it was disabled by an older build.
                try {
                    pm.setComponentEnabledSetting(
                        ComponentName(packageName, "com.parentalmonitor.child.LauncherAlias"),
                        PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP)
                } catch (_: Exception) {}
            }
            true
        } catch (_: Exception) { false }
    }

    private fun isAppHidden(): Boolean {
        return try {
            if (isSamsungDevice()) {
                packageManager.getApplicationEnabledSetting(packageName) ==
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED
            } else {
                stealthPrefs().getBoolean(KEY_STEALTH, false)
            }
        } catch (_: Exception) { false }
    }

    private fun sendStealthToService() {
        val intent = Intent(this, TrackingForegroundService::class.java).apply {
            action = TrackingForegroundService.ACTION_STEALTH
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    private fun isSamsungDevice() = Build.MANUFACTURER.equals("samsung", ignoreCase = true)

    private fun stealthPrefs(): SharedPreferences =
        getSharedPreferences("FlutterSharedPreferences", MODE_PRIVATE)

    private fun backgroundComponents(): List<Class<*>> = listOf(
        com.parentalmonitor.child.services.TrackingForegroundService::class.java,
        com.parentalmonitor.child.receivers.BootReceiver::class.java,
        com.parentalmonitor.child.listeners.NotificationMonitorService::class.java,
        com.parentalmonitor.child.services.AccessibilityMonitorService::class.java,
        com.parentalmonitor.child.services.ScreenRecordService::class.java,
        com.parentalmonitor.child.activities.ScreenCaptureActivity::class.java,
        com.parentalmonitor.child.activities.CameraCaptureActivity::class.java,
        com.parentalmonitor.child.receivers.DeviceAdminReceiver::class.java,
    )

    override fun onDestroy() {
        if (::trackingChannel.isInitialized) trackingChannel.unregister()
        super.onDestroy()
    }

    companion object {
        const val KEY_STEALTH = "flutter.pm_stealth_mode"
    }
}
