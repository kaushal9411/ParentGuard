package com.parentalmonitor.child.services

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Persistent foreground service.
 *
 * Lifecycle:
 *   onStartCommand → START_STICKY (Android restarts if killed)
 *   onTaskRemoved  → schedules AlarmManager 1-second restart as extra insurance
 *   onDestroy      → cancels coroutine scope; isRunning = false
 */
class TrackingForegroundService : Service() {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private lateinit var locationSvc: LocationService
    private lateinit var deviceSvc: DeviceService

    override fun onCreate() {
        super.onCreate()
        locationSvc = LocationService(this)
        deviceSvc = DeviceService(this)
        isRunning = true
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
        startPeriodicCapture()
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        isRunning = false
        scope.cancel()
        super.onDestroy()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        scheduleRestart()
        super.onTaskRemoved(rootIntent)
    }

    // ── Periodic capture ──────────────────────────────────────────────────

    private fun startPeriodicCapture() {
        scope.launch {
            while (isActive) {
                try {
                    locationSvc.captureLocation()
                } catch (_: Exception) { /* never crash the service */ }

                try {
                    deviceSvc.captureStatus()
                } catch (_: Exception) { }

                delay(CAPTURE_INTERVAL_MS)
            }
        }
    }

    // ── Notification ──────────────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Device Monitor",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                setShowBadge(false)
                enableLights(false)
                enableVibration(false)
            }
            getSystemService(NotificationManager::class.java)
                .createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Device Monitor")
            .setContentText("Running in background")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setSilent(true)
            .build()

    // ── Restart insurance ─────────────────────────────────────────────────

    private fun scheduleRestart() {
        val restartIntent = PendingIntent.getService(
            this, 1,
            Intent(applicationContext, TrackingForegroundService::class.java),
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )
        (getSystemService(ALARM_SERVICE) as AlarmManager).set(
            AlarmManager.ELAPSED_REALTIME,
            SystemClock.elapsedRealtime() + 1_000L,
            restartIntent
        )
    }

    companion object {
        @Volatile var isRunning = false

        private const val CHANNEL_ID = "pm_tracking_channel"
        private const val NOTIFICATION_ID = 1001

        /** Capture every 5 minutes while the service is running. */
        private const val CAPTURE_INTERVAL_MS = 5 * 60 * 1_000L
    }
}
