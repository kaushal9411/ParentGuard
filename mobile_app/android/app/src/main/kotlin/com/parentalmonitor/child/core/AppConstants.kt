package com.parentalmonitor.child.core

import com.parentalmonitor.child.BuildConfig

object AppConstants {
    // Injected at build time from --dart-define=BACKEND_URL=<url>
    // See android/app/build.gradle for the injection logic.
    val backendBaseUrl: String = BuildConfig.BACKEND_URL
}
