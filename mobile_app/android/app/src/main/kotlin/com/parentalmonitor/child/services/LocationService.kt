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

    companion object {
        private const val PREFS_KEY  = "pm_location"
        private const val KEY_LAST   = "last_location"
        private const val KEY_TIME   = "last_location_time"
    }
}
