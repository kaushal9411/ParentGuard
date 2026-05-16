import '../core/utils/device_id.dart';
import '../features/device_status/device_status_service.dart';
import '../features/location/location_service.dart';
import '../features/usage_tracking/usage_tracking_service.dart';
import '../services/event_queue_service.dart';
import '../services/sync_service.dart';
import '../storage/app_database.dart';

/// Static entry points called from the WorkManager callback dispatcher.
/// Each method opens its own short-lived DB connection to avoid sharing
/// state with the main isolate.
class BackgroundWorker {
  static Future<void> syncPendingEvents() async {
    final db = AppDatabase();
    try {
      final queue = EventQueueService(db);
      final sync = SyncService(db, queue);
      await sync.sync();
    } finally {
      await db.close();
    }
  }

  static Future<void> captureLocationSnapshot() async {
    final db = AppDatabase();
    try {
      final deviceId = await DeviceIdUtil.get();
      final svc = LocationService(db);
      await svc.captureAndStore(deviceId);
    } finally {
      await db.close();
    }
  }

  static Future<void> captureUsageSnapshot() async {
    final db = AppDatabase();
    try {
      final deviceId = await DeviceIdUtil.get();
      final svc = UsageTrackingService(db);
      await svc.captureAndStore(deviceId);
    } finally {
      await db.close();
    }
  }

  static Future<void> captureDeviceStatus() async {
    final db = AppDatabase();
    try {
      final deviceId = await DeviceIdUtil.get();
      final svc = DeviceStatusService(db);
      await svc.captureAndStore(deviceId);
    } finally {
      await db.close();
    }
  }
}
