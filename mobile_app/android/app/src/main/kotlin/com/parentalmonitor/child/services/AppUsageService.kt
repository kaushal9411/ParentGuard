package com.parentalmonitor.child.services

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.Settings
import org.json.JSONArray
import org.json.JSONObject

/**
 * Wraps UsageStatsManager.
 *
 * NOTE: PACKAGE_USAGE_STATS is a protected permission.
 * Users must grant it manually via Settings → Apps → Special App Access.
 */
class AppUsageService(private val ctx: Context) {

    private val usageManager =
        ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

    fun getUsageStats(fromMs: Long, toMs: Long): String {
        if (!hasUsagePermission()) return """{"error":"no_permission"}"""

        val stats = usageManager.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY, fromMs, toMs
        ) ?: return "[]"

        val result = JSONArray()
        stats.filter { it.totalTimeInForeground > 0 }
            .sortedByDescending { it.totalTimeInForeground }
            .forEach { stat ->
                result.put(JSONObject().apply {
                    put("packageName",    stat.packageName)
                    put("appName",        getAppName(stat.packageName))
                    put("usageDurationMs", stat.totalTimeInForeground)
                    put("lastUsed",       stat.lastTimeUsed)
                })
            }

        return result.toString()
    }

    fun getInstalledApps(): String {
        val pm = ctx.packageManager
        val apps = pm.getInstalledApplications(PackageManager.GET_META_DATA)
            .filter { pm.getLaunchIntentForPackage(it.packageName) != null }

        val result = JSONArray()
        apps.forEach { app ->
            result.put(JSONObject().apply {
                put("packageName", app.packageName)
                put("appName",     pm.getApplicationLabel(app).toString())
            })
        }
        return result.toString()
    }

    fun hasUsagePermission(): Boolean {
        val ops = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = ops.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            android.os.Process.myUid(),
            ctx.packageName
        )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    fun openUsageSettings() {
        ctx.startActivity(
            Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
    }

    private fun getAppName(pkg: String): String = try {
        ctx.packageManager.run {
            getApplicationLabel(getApplicationInfo(pkg, 0)).toString()
        }
    } catch (_: PackageManager.NameNotFoundException) { pkg }
}
