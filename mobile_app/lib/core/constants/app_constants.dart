class AppConstants {
  AppConstants._();

  static const String appName = 'ParentalMonitor';

  // ── WorkManager task names ────────────────────────────────────────────────
  static const String syncTaskName         = 'pm_sync_task';
  static const String locationTaskName     = 'pm_location_task';
  static const String usageTaskName        = 'pm_usage_task';
  static const String deviceStatusTaskName = 'pm_device_status_task';
  static const String fullSyncTaskName     = 'pm_full_sync_task';

  // ── Intervals ─────────────────────────────────────────────────────────────
  static const int locationIntervalMinutes = 5;
  static const int syncIntervalMinutes = 15;
  static const int usageSnapshotIntervalMinutes = 10;

  // ── Sync / queue config ───────────────────────────────────────────────────
  static const int syncBatchSize = 50;
  static const int maxQueueSize = 1000;
  static const int maxRetryAttempts = 3;

  // ── Database ──────────────────────────────────────────────────────────────
  static const String dbName = 'parental_monitor';
  static const int dbVersion = 1;

  // ── SharedPreferences keys ────────────────────────────────────────────────
  static const String prefDeviceId = 'pref_device_id';
  static const String prefLastSync = 'pref_last_sync';
  static const String prefTrackingEnabled = 'pref_tracking_enabled';

  // ── Backend ───────────────────────────────────────────────────────────────
  // Controlled via --dart-define=BACKEND_URL=<url> at build/run time.
  // USB + adb reverse tcp:3000 tcp:3000  → http://localhost:3000  (default)
  // Emulator loopback                    → http://10.0.2.2:3000
  // WiFi (no USB)                        → http://<PC-LAN-IP>:3000
  static const String backendBaseUrl = String.fromEnvironment(
    'BACKEND_URL',
    defaultValue: 'http://localhost:3000',
  );

  // ── Data retention (days) ─────────────────────────────────────────────────
  static const int locationRetentionDays = 30;
  static const int usageRetentionDays = 30;
  static const int notificationRetentionDays = 14;
}
