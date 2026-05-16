import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';
import '../../core/utils/logger.dart';
import '../../models/notification_model.dart';
import '../../storage/app_database.dart';
import '../../storage/tables/notification_entries.dart';

class NotificationService {
  NotificationService(this._db);

  final AppDatabase _db;
  final _uuid = const Uuid();

  /// Called by the Kotlin NotificationMonitorService via the platform channel
  /// (or polled from shared prefs). Persists a captured notification.
  Future<void> persistNotification({
    required String deviceId,
    required String packageName,
    required String appName,
    required String title,
    required String body,
    required DateTime postedAt,
    String? category,
    Map<String, dynamic>? extras,
  }) async {
    await _db.notificationDao.upsert(
      NotificationEntriesCompanion.insert(
        id: _uuid.v4(),
        deviceId: deviceId,
        packageName: packageName,
        appName: appName,
        title: title,
        body: body,
        postedAt: postedAt,
      ),
    );

    appLogger.d('Notification stored: $appName — $title');
  }

  Future<List<NotificationEntry>> getRecent({int limit = 100}) =>
      _db.notificationDao.getRecent(limit: limit);

  Future<int> pruneOldRecords(int days) {
    final cutoff = DateTime.now().subtract(Duration(days: days));
    return _db.notificationDao.deleteOlderThan(cutoff);
  }
}
