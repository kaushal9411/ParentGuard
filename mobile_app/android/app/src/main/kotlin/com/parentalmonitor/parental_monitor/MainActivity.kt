package com.parentalmonitor.parental_monitor

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import com.parentalmonitor.child.services.TrackingForegroundService

class MainActivity : FlutterActivity() {
    private val LAUNCHER_CHANNEL = "com.parental_monitor.app/launcher"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // ── Set up launcher visibility channel ──────────────────────────────────────
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, LAUNCHER_CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "hideIcon" -> {
                        val success = hideAppIcon()
                        result.success(success)
                    }
                    "showIcon" -> {
                        val success = showAppIcon()
                        result.success(success)
                    }
                    "isIconHidden" -> {
                        val hidden = isAppIconHidden()
                        result.success(hidden)
                    }
                    "hideApp" -> {
                        // 1. Hide launcher icon
                        hideAppIcon()
                        // 2. Switch service notification to silent channel (no status-bar icon)
                        val svcIntent = Intent(this, TrackingForegroundService::class.java).apply {
                            action = TrackingForegroundService.ACTION_STEALTH
                        }
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            startForegroundService(svcIntent)
                        } else {
                            startService(svcIntent)
                        }
                        // 3. Move app to background
                        moveTaskToBack(true)
                        result.success(true)
                    }
                    else -> result.notImplemented()
                }
            }
    }

    /**
     * Hide app icon from launcher COMPLETELY (stealth mode)
     * Disables BOTH the main activity AND the launcher alias
     * App is ONLY accessible via:
     * - Settings → Apps → All apps → Parental Monitor
     * - Direct intent/adb
     * NOT visible in: Launcher, Recent Apps, App Drawer
     */
    private fun hideAppIcon(): Boolean {
        return try {
            // Disable launcher alias (primary launcher entry)
            val launcherAlias = ComponentName(
                this,
                "com.parentalmonitor.parental_monitor.LauncherAlias"
            )
            packageManager.setComponentEnabledSetting(
                launcherAlias,
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP
            )

            // Disable main activity from launcher (prevents alternate entry)
            val mainActivity = ComponentName(
                this,
                "com.parentalmonitor.parental_monitor.MainActivity"
            )
            packageManager.setComponentEnabledSetting(
                mainActivity,
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP
            )

            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    /**
     * Show app icon in launcher
     * Re-enables both components so icon appears in launcher
     */
    private fun showAppIcon(): Boolean {
        return try {
            // Re-enable launcher alias
            val launcherAlias = ComponentName(
                this,
                "com.parentalmonitor.parental_monitor.LauncherAlias"
            )
            packageManager.setComponentEnabledSetting(
                launcherAlias,
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                PackageManager.DONT_KILL_APP
            )

            // Re-enable main activity
            val mainActivity = ComponentName(
                this,
                "com.parentalmonitor.parental_monitor.MainActivity"
            )
            packageManager.setComponentEnabledSetting(
                mainActivity,
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                PackageManager.DONT_KILL_APP
            )

            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    /**
     * Check if app icon is currently hidden
     */
    private fun isAppIconHidden(): Boolean {
        return try {
            val component = ComponentName(
                this,
                "com.parentalmonitor.parental_monitor.LauncherAlias"
            )
            val state = packageManager.getComponentEnabledSetting(component)
            state == PackageManager.COMPONENT_ENABLED_STATE_DISABLED
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
}
