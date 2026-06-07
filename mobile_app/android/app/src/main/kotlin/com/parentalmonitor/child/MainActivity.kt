package com.parentalmonitor.child

import android.content.Intent
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

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // Debug: re-enable the app on every launch so flutter run never gets stuck
        // after a stealth-mode test disabled the package.
        if (BuildConfig.DEBUG) setAppVisible(true)
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
                "hideIcon"     -> result.success(setAppVisible(false))
                "showIcon"     -> result.success(setAppVisible(true))
                "isIconHidden" -> result.success(isAppHidden())
                "hideApp"      -> {
                    sendStealthToService()
                    // Disable the ENTIRE application at the package-manager level.
                    // This is the same signal Samsung's launcher responds to for installs/
                    // uninstalls — the icon disappears immediately from One UI's launcher
                    // database. DONT_KILL_APP keeps the current process alive so the
                    // tracking foreground service keeps running without interruption.
                    setAppVisible(false)
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

    private fun setAppVisible(visible: Boolean): Boolean {
        return try {
            val state = if (visible)
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED
            else
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED
            packageManager.setApplicationEnabledSetting(
                packageName, state, PackageManager.DONT_KILL_APP
            )
            true
        } catch (_: Exception) { false }
    }

    private fun isAppHidden(): Boolean {
        return try {
            packageManager.getApplicationEnabledSetting(packageName) ==
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED
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

    override fun onDestroy() {
        trackingChannel.unregister()
        super.onDestroy()
    }
}
