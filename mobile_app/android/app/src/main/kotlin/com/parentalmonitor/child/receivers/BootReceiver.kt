package com.parentalmonitor.child.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import com.parentalmonitor.child.services.TrackingForegroundService

/**
 * Restarts the tracking foreground service after:
 *   - Device boot completes (BOOT_COMPLETED)
 *   - Quick-boot / warm-boot on some OEM ROMs (QUICKBOOT_POWERON)
 *   - App self-update (MY_PACKAGE_REPLACED) — prevents gaps after updates
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return

        if (action !in BOOT_ACTIONS) return

        val serviceIntent = Intent(context, TrackingForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }

    companion object {
        private val BOOT_ACTIONS = setOf(
            Intent.ACTION_BOOT_COMPLETED,
            "android.intent.action.QUICKBOOT_POWERON",   // HTC / some ROMs
            "com.htc.intent.action.QUICKBOOT_POWERON",   // HTC legacy
            Intent.ACTION_MY_PACKAGE_REPLACED
        )
    }
}
