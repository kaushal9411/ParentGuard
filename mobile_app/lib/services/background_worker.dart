import '../core/utils/device_id.dart';
import '../core/utils/logger.dart';
import '../features/device_status/device_status_service.dart';
import '../features/location/location_service.dart';
import '../features/usage_tracking/usage_tracking_service.dart';
import '../models/event_queue_model.dart';
import '../services/event_queue_service.dart';
import '../services/monitoring_service.dart';
import '../services/sync_service.dart';
import '../storage/app_database.dart';

/// Static entry points called from WorkManager and the main isolate.
///
/// KEY RULE: every method that touches the database must reuse the SAME
/// AppDatabase instance within a single captureAllAndSync() call.
/// Opening multiple AppDatabase instances against the same file causes
/// SQLite "database is locked" errors (code 5).
class BackgroundWorker {

  // ── Standalone helpers (used individually, e.g. from WorkManager) ─────────

  static Future<void> syncPendingEvents() async {
    final db = AppDatabase();
    try {
      final queue = EventQueueService(db);
      final sync  = SyncService(db, queue);
      await sync.sync();
    } finally {
      await db.close();
    }
  }

  static Future<void> captureLocationSnapshot() async {
    final db = AppDatabase();
    try {
      await _doLocation(db);
    } finally {
      await db.close();
    }
  }

  static Future<void> captureDeviceStatus() async {
    final db = AppDatabase();
    try {
      await _doDeviceStatus(db);
    } finally {
      await db.close();
    }
  }

  static Future<void> captureUsageSnapshot() async {
    final db = AppDatabase();
    try {
      await _doUsage(db);
    } finally {
      await db.close();
    }
  }

  // ── Full immediate capture + sync — ONE database for the entire call ───────

  /// Captures all data and uploads to the backend in a single pass.
  /// Must be called from the main Flutter isolate (MethodChannels required).
  static Future<void> captureAllAndSync() async {
    final db = AppDatabase();
    try {
      try { await _doLocation(db);    } catch (_) {}
      try { await _doDeviceStatus(db);} catch (_) {}
      try { await _doUsage(db);       } catch (_) {}
      try { await _doMonitoring(db);  } catch (_) {}

      final queue = EventQueueService(db);
      final sync  = SyncService(db, queue);
      await sync.sync();

      appLogger.i('BackgroundWorker: full capture+sync complete');
    } finally {
      await db.close();
    }
  }

  // ── Private single-DB helpers ──────────────────────────────────────────────

  static Future<void> _doLocation(AppDatabase db) async {
    final deviceId = await DeviceIdUtil.get();
    final svc      = LocationService(db);
    final queue    = EventQueueService(db);

    final model = await svc.captureAndStore(deviceId);
    if (model != null) {
      await queue.enqueue(EventType.location, {
        'latitude':    model.latitude,
        'longitude':   model.longitude,
        'accuracy':    model.accuracy,
        'altitude':    model.altitude,
        'speed':       model.speed,
        'heading':     model.heading,
        'provider':    model.provider,
        'capturedAt':  model.capturedAt.toIso8601String(),
      });
      appLogger.d('BackgroundWorker: location enqueued');
    }
  }

  static Future<void> _doDeviceStatus(AppDatabase db) async {
    final deviceId = await DeviceIdUtil.get();
    final svc      = DeviceStatusService(db);
    final queue    = EventQueueService(db);

    final model = await svc.captureAndStore(deviceId);
    await queue.enqueue(EventType.deviceStatus, {
      'batteryLevel':   model.batteryLevel,
      'isCharging':     model.isCharging,
      'networkType':    model.networkType,
      'isConnected':    model.isConnected,
      'wifiSsid':       model.wifiSsid,
      'signalStrength': model.signalStrength,
      'capturedAt':     model.capturedAt.toIso8601String(),
    });
    appLogger.d('BackgroundWorker: device status enqueued');
  }

  static Future<void> _doUsage(AppDatabase db) async {
    final deviceId = await DeviceIdUtil.get();
    final svc      = UsageTrackingService(db);
    final queue    = EventQueueService(db);

    final models = await svc.captureAndStore(deviceId);
    for (final model in models) {
      await queue.enqueue(EventType.appUsage, {
        'packageName':    model.packageName,
        'appName':        model.appName,
        'usageDurationMs': model.usageDurationMs,
        'launchCount':    0,
        'capturedAt':     model.capturedAt.toIso8601String(),
      });
    }
    if (models.isNotEmpty) {
      appLogger.d('BackgroundWorker: ${models.length} usage records enqueued');
    }
  }

  static Future<void> _doMonitoring(AppDatabase db) async {
    final queue   = EventQueueService(db);
    final monitor = MonitoringService(queue);
    await monitor.collectNow();
  }
}
