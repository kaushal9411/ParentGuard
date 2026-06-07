package com.parentalmonitor.child.services

import android.annotation.SuppressLint
import android.content.Context
import com.google.android.gms.location.CurrentLocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import android.location.Location
import org.json.JSONObject

/**
 * Wraps FusedLocationProviderClient.
 *
 * captureLocation() — fire-and-forget, persists to SharedPrefs
 * getLastLocation()  — async callback, returns JSON string
 */
class LocationService(private val ctx: Context) {

    private val fusedClient = LocationServices.getFusedLocationProviderClient(ctx)

    @SuppressLint("MissingPermission")
    fun captureLocation() {
        val request = CurrentLocationRequest.Builder()
            .setPriority(Priority.PRIORITY_HIGH_ACCURACY)
            .setDurationMillis(10_000)
            .setMaxUpdateAgeMillis(30_000)
            .build()

        fusedClient.getCurrentLocation(request, null)
            .addOnSuccessListener { loc -> loc?.let { persist(it) } }
    }

    @SuppressLint("MissingPermission")
    fun getLastLocation(callback: (String) -> Unit) {
        fusedClient.lastLocation.addOnSuccessListener { loc ->
            callback(if (loc != null) toJson(loc) else """{"error":"no_location"}""")
        }.addOnFailureListener {
            callback("""{"error":"${it.message}"}""")
        }
    }

    private fun persist(loc: Location) {
        ctx.getSharedPreferences(PREFS_KEY, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_LAST, toJson(loc))
            .putLong(KEY_TIME, System.currentTimeMillis())
            .apply()
    }

    private fun toJson(loc: Location): String = JSONObject().apply {
        put("latitude",  loc.latitude)
        put("longitude", loc.longitude)
        put("accuracy",  loc.accuracy)
        put("altitude",  loc.altitude)
        put("speed",     loc.speed)
        put("bearing",   loc.bearing)
        put("provider",  loc.provider ?: "unknown")
        put("timestamp", loc.time)
    }.toString()

    /** Uploads the last captured location to /api/events/batch (skips if older than 10 min). */
    fun syncLocation(token: String, deviceId: String, baseUrl: String) {
        val permOk = ctx.checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED ||
            ctx.checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
        if (!permOk) {
            android.util.Log.w(TAG, "SKIP — location permission not granted")
            return
        }

        val prefs      = ctx.getSharedPreferences(PREFS_KEY, Context.MODE_PRIVATE)
        val locJson    = prefs.getString(KEY_LAST, null) ?: run {
            android.util.Log.d(TAG, "No stored location to sync")
            return
        }
        val capturedAt = prefs.getLong(KEY_TIME, 0L)
        val ageMs      = System.currentTimeMillis() - capturedAt
        if (ageMs > 10 * 60_000L) {
            android.util.Log.d(TAG, "Stored location too old (${ageMs / 60_000} min), skipping")
            return
        }

        android.util.Log.d(TAG, "Syncing location (age ${ageMs / 1000}s) …")

        val payload = try {
            org.json.JSONObject(locJson).apply { put("capturedAt", capturedAt) }
        } catch (_: Exception) { return }

        val events = org.json.JSONArray().apply {
            put(org.json.JSONObject().apply {
                put("id",      "${deviceId}_loc_${capturedAt}")
                put("type",    "location")
                put("payload", payload)
            })
        }
        val body = org.json.JSONObject().apply {
            put("deviceId", deviceId)
            put("events",   events)
        }.toString().toByteArray(Charsets.UTF_8)

        try {
            val conn = (java.net.URL("$baseUrl/api/events/batch").openConnection()
                as java.net.HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Authorization", "Bearer $token")
                setRequestProperty("Content-Type",  "application/json")
                doOutput       = true
                connectTimeout = 15_000
                readTimeout    = 30_000
                setFixedLengthStreamingMode(body.size.toLong())
            }
            conn.outputStream.use { it.write(body) }
            val code = conn.responseCode
            conn.disconnect()
            if (code == 200 || code == 201) {
                android.util.Log.d(TAG, "Location synced ✓ (${payload.optDouble("latitude")}, ${payload.optDouble("longitude")})")
            } else {
                android.util.Log.w(TAG, "Location sync HTTP $code")
            }
        } catch (e: Exception) {
            android.util.Log.w(TAG, "Location sync failed: ${e.message}")
        }
    }

    companion object {
        private const val TAG        = "LocationService"
        private const val PREFS_KEY  = "pm_location"
        private const val KEY_LAST   = "last_location"
        private const val KEY_TIME   = "last_location_time"
    }
}
