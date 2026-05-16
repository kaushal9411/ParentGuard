package com.parentalmonitor.child.services

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import org.json.JSONObject

class DeviceService(private val ctx: Context) {

    fun getBatteryJson(): String {
        val intent = ctx.registerReceiver(
            null, IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        )
        val level  = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)   ?: -1
        val scale  = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1)   ?: -1
        val status = intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1)  ?: -1

        val pct = if (level >= 0 && scale > 0) level * 100 / scale else -1
        val charging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                       status == BatteryManager.BATTERY_STATUS_FULL

        return JSONObject().apply {
            put("level",      pct)
            put("isCharging", charging)
            put("status",     status)
        }.toString()
    }

    fun getNetworkJson(): String {
        val cm = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val net  = cm.activeNetwork
        val caps = cm.getNetworkCapabilities(net)
        val connected = net != null && caps != null

        val type = when {
            caps == null                                               -> "none"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)     -> "wifi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "mobile"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
            else                                                       -> "unknown"
        }

        return JSONObject().apply {
            put("isConnected", connected)
            put("networkType", type)
        }.toString()
    }

    fun getDeviceInfoJson(): String = JSONObject().apply {
        put("model",          Build.MODEL)
        put("manufacturer",   Build.MANUFACTURER)
        put("androidVersion", Build.VERSION.RELEASE)
        put("androidSdk",     Build.VERSION.SDK_INT)
        put("brand",          Build.BRAND)
    }.toString()

    fun captureStatus() {
        val snapshot = JSONObject().apply {
            put("battery",   JSONObject(getBatteryJson()))
            put("network",   JSONObject(getNetworkJson()))
            put("timestamp", System.currentTimeMillis())
        }
        ctx.getSharedPreferences("pm_device_status", Context.MODE_PRIVATE)
            .edit()
            .putString("last_status", snapshot.toString())
            .apply()
    }
}
