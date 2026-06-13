package com.parentalmonitor.child.core

import android.content.Context
import com.parentalmonitor.child.BuildConfig

/**
 * Single source of truth for the backend URL.
 *
 * The URL is defined ONCE via --dart-define=BACKEND_URL at build time. Dart
 * (main.dart) persists it to SharedPreferences under "backend_url", and the
 * native services read that exact value here — no separate gradle/BuildConfig
 * wiring that can drift out of sync. The persisted value survives reboot, so the
 * boot-started foreground service uses the correct URL too.
 *
 * Call [init] once (from a Context) before reading [backendBaseUrl].
 */
object AppConstants {
    @Volatile private var cachedUrl: String? = null

    fun init(context: Context) {
        try {
            val prefs = context.getSharedPreferences(
                "FlutterSharedPreferences", Context.MODE_PRIVATE)
            val url = prefs.getString("flutter.backend_url", null)
            if (!url.isNullOrBlank()) cachedUrl = url
        } catch (_: Exception) {}
    }

    val backendBaseUrl: String
        get() = cachedUrl ?: BuildConfig.BACKEND_URL
}
