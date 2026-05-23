package com.parentalmonitor.child.activities

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import com.parentalmonitor.child.services.ScreenRecordService

/**
 * Transparent trampoline activity that shows the MediaProjection consent dialog.
 * Set [projectionCallback] before starting this Activity; it is called once with
 * (resultCode, projectionData) and then cleared.
 */
class ScreenCaptureActivity : Activity() {

    companion object {
        @Volatile var projectionCallback: ((Int, Intent?) -> Unit)? = null
        private const val REQ = 1001
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (savedInstanceState != null) { finish(); return }
        val mgr = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        @Suppress("DEPRECATION")
        startActivityForResult(mgr.createScreenCaptureIntent(), REQ)
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQ) {
            // Android 14+: a mediaProjection foreground service MUST be started from the
            // Activity that received the screen-capture consent result — starting it from a
            // background service is silently rejected on API 34+.
            if (resultCode == RESULT_OK && data != null) {
                val svcIntent = Intent(this, ScreenRecordService::class.java).apply {
                    putExtra("resultCode",     resultCode)
                    putExtra("projectionData", data)
                }
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        startForegroundService(svcIntent)
                    } else {
                        startService(svcIntent)
                    }
                } catch (_: Exception) {}
            }
            projectionCallback?.invoke(resultCode, data)
            projectionCallback = null
        }
        finish()
    }
}
