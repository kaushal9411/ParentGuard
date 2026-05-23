package com.parentalmonitor.child.services

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.MediaRecorder
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.DisplayMetrics
import android.util.Log
import androidx.core.app.NotificationCompat
import java.io.File

/**
 * Foreground service that records the screen using MediaProjection + MediaRecorder.
 *
 * Start via an explicit Intent carrying "resultCode" (Int) and "projectionData" (Intent).
 * Stop by calling [stopAndGetFile], which finalises the MP4 and delivers the raw file.
 */
class ScreenRecordService : Service() {

    private var projection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var recorder: MediaRecorder? = null
    private var outputFile: File? = null
    private var startMs = 0L

    companion object {
        @Volatile var instance:   ScreenRecordService? = null
        @Volatile var lastError:  String?              = null   // set before stopSelf() on crash

        private const val TAG        = "ScreenRecordService"
        private const val CHANNEL_ID = "pm_screen_record"
        private const val NOTIF_ID   = 9_003
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        instance  = this
        lastError = null
        ensureChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val resultCode: Int = intent?.getIntExtra("resultCode", 0) ?: 0
        val projData: android.content.Intent? =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
                intent?.getParcelableExtra("projectionData", android.content.Intent::class.java)
            else
                @Suppress("DEPRECATION") intent?.getParcelableExtra("projectionData")

        if (resultCode == 0 || projData == null) {
            fail("missing projection token (resultCode=$resultCode projData=${projData != null})")
            return START_NOT_STICKY
        }

        // API 29+: must pass the service type explicitly so the system knows this is a
        // mediaProjection foreground service — otherwise getMediaProjection() throws.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIF_ID,
                buildNotification(),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION,
            )
        } else {
            startForeground(NOTIF_ID, buildNotification())
        }

        val error = beginRecording(resultCode, projData)
        if (error != null) {
            fail(error)
        }

        return START_NOT_STICKY
    }

    override fun onDestroy() {
        instance = null
        releaseAll()
        super.onDestroy()
    }

    override fun onBind(intent: android.content.Intent?): IBinder? = null

    // ── Recording setup ───────────────────────────────────────────────────────

    /**
     * Returns null on success, or a human-readable error string on any failure.
     * Each step is individually caught so the caller can surface the exact point of failure.
     */
    private fun beginRecording(resultCode: Int, projData: android.content.Intent): String? {

        // Step 1 — obtain MediaProjection
        val proj = try {
            val mgr = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            mgr.getMediaProjection(resultCode, projData)
                ?: return "getMediaProjection returned null"
        } catch (e: Exception) {
            return "getMediaProjection failed: ${e.javaClass.simpleName}: ${e.message}"
        }

        // Android 14+ requires a callback registered BEFORE createVirtualDisplay is called.
        // Without this the system throws IllegalStateException.
        proj.registerCallback(object : MediaProjection.Callback() {
            override fun onStop() {
                Log.d(TAG, "MediaProjection stopped by system")
                lastError = "MediaProjection stopped by system"
                stopSelf()
            }
        }, Handler(Looper.getMainLooper()))

        projection = proj

        // Step 2 — compute recording dimensions via DisplayManager (safe in any context)
        val (width, height, dpi) = try {
            val dm  = DisplayMetrics()
            val displayMgr = getSystemService(DISPLAY_SERVICE) as DisplayManager
            displayMgr.getDisplay(android.view.Display.DEFAULT_DISPLAY)
                ?.getRealMetrics(dm)

            val rawW = dm.widthPixels.takeIf  { it > 0 } ?: 1080
            val rawH = dm.heightPixels.takeIf { it > 0 } ?: 1920
            val scale = if (rawW > 720) 720f / rawW else 1f
            val w = (rawW * scale).toInt().let { if (it % 2 == 0) it else it - 1 }
            val h = (rawH * scale).toInt().let { if (it % 2 == 0) it else it - 1 }
            val d = (dm.densityDpi * scale).toInt().coerceAtLeast(120)
            Triple(w, h, d)
        } catch (e: Exception) {
            Triple(720, 1280, 160)   // safe fallback
        }

        // Step 3 — create output file
        outputFile = try {
            File(cacheDir, "screenrec_${System.currentTimeMillis()}.mp4")
                .also { it.parentFile?.mkdirs() }
        } catch (e: Exception) {
            return "output file creation failed: ${e.message}"
        }
        startMs = System.currentTimeMillis()

        // Step 4 — configure MediaRecorder
        val rec = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
                MediaRecorder(this)
            else
                @Suppress("DEPRECATION") MediaRecorder()
        } catch (e: Exception) {
            return "MediaRecorder constructor: ${e.message}"
        }

        rec.setOnErrorListener { _, what, extra ->
            Log.e(TAG, "MediaRecorder async error: what=$what extra=$extra")
            lastError = "MediaRecorder runtime error $what/$extra"
            stopSelf()
        }

        try {
            rec.setVideoSource(MediaRecorder.VideoSource.SURFACE)
        } catch (e: Exception) {
            rec.release(); return "setVideoSource: ${e.message}"
        }
        try {
            rec.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        } catch (e: Exception) {
            rec.release(); return "setOutputFormat: ${e.message}"
        }
        try {
            rec.setVideoEncoder(MediaRecorder.VideoEncoder.H264)
        } catch (e: Exception) {
            rec.release(); return "setVideoEncoder: ${e.message}"
        }
        try {
            rec.setVideoSize(width, height)
        } catch (e: Exception) {
            // Some devices reject explicit sizes — skip and let the encoder decide
            Log.w(TAG, "setVideoSize($width,$height) failed — skipping: ${e.message}")
        }
        try {
            rec.setVideoFrameRate(15)
        } catch (e: Exception) {
            Log.w(TAG, "setVideoFrameRate failed: ${e.message}")
        }
        try {
            rec.setVideoEncodingBitRate(1_500_000)
        } catch (e: Exception) {
            Log.w(TAG, "setVideoEncodingBitRate failed: ${e.message}")
        }
        try {
            rec.setOutputFile(outputFile!!.absolutePath)
        } catch (e: Exception) {
            rec.release(); return "setOutputFile: ${e.message}"
        }
        try {
            rec.prepare()
        } catch (e: Exception) {
            rec.release(); return "prepare() failed: ${e.javaClass.simpleName}: ${e.message}"
        }
        recorder = rec

        // Step 5 — create VirtualDisplay
        virtualDisplay = try {
            proj.createVirtualDisplay(
                "PMScreenRec",
                width, height, dpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                rec.surface, null, null,
            )
        } catch (e: Exception) {
            rec.release(); recorder = null
            return "createVirtualDisplay: ${e.javaClass.simpleName}: ${e.message}"
        }

        // Step 6 — start
        try {
            rec.start()
        } catch (e: Exception) {
            rec.release(); recorder = null
            virtualDisplay?.release(); virtualDisplay = null
            return "start() failed: ${e.javaClass.simpleName}: ${e.message}"
        }

        Log.d(TAG, "recording OK: ${width}x${height}@${dpi}dpi -> ${outputFile!!.name}")
        return null   // success
    }

    // ── Stop & hand back file ─────────────────────────────────────────────────

    fun stopAndGetFile(callback: (file: File?, durationSec: Int) -> Unit) {
        try { recorder?.stop(); recorder?.release() } catch (_: Exception) {}
        recorder = null
        try { virtualDisplay?.release() } catch (_: Exception) {}
        virtualDisplay = null
        try { projection?.stop() } catch (_: Exception) {}
        projection = null

        val file     = outputFile
        val duration = ((System.currentTimeMillis() - startMs) / 1000).toInt()
        outputFile = null; startMs = 0L

        callback(file?.takeIf { it.exists() && it.length() > 0 }, duration)
        stopSelf()
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun fail(reason: String) {
        Log.e(TAG, "fail: $reason")
        lastError = reason
        stopSelf()
    }

    private fun releaseAll() {
        try { recorder?.release()       } catch (_: Exception) {}
        try { virtualDisplay?.release() } catch (_: Exception) {}
        try { projection?.stop()        } catch (_: Exception) {}
        recorder = null; virtualDisplay = null; projection = null
        outputFile?.delete(); outputFile = null
    }

    private fun buildNotification(): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Screen Recording")
            .setContentText("ParentGard is recording the screen")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(true)
            .build()

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(
                CHANNEL_ID, "Screen Recording", NotificationManager.IMPORTANCE_LOW
            ).apply { description = "Shown while screen recording is active" }
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(ch)
        }
    }
}
