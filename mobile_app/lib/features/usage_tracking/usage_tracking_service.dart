import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';
import '../../core/utils/logger.dart';
import '../../models/app_usage_model.dart';
import '../../platform/tracking_channel.dart';
import '../../storage/app_database.dart';
import '../../storage/tables/app_usage_entries.dart';

class UsageTrackingService {
  UsageTrackingService(this._db);

  final AppDatabase _db;
  final _channel = TrackingChannel.instance;
  final _uuid = const Uuid();

  /// Fetches today's usage stats from Android UsageStatsManager via the
  /// platform channel and stores each app's duration in the local DB.
  Future<List<AppUsageModel>> captureAndStore(String deviceId) async {
    final hasPermission = await _channel.hasUsagePermission();
    if (!hasPermission) {
      appLogger.w('UsageStats permission not granted — skipping capture');
      return [];
    }

    final now = DateTime.now();
    final startOfDay = DateTime(now.year, now.month, now.day);

    final raw = await _channel.getUsageStats(from: startOfDay, to: now);
    final models = <AppUsageModel>[];

    for (final stat in raw) {
      final model = AppUsageModel(
        id: _uuid.v4(),
        deviceId: deviceId,
        packageName: stat['packageName'] as String,
        appName: stat['appName'] as String? ?? stat['packageName'] as String,
        usageDurationMs: (stat['usageDurationMs'] as num).toInt(),
        lastUsed: DateTime.fromMillisecondsSinceEpoch(
          (stat['lastUsed'] as num).toInt(),
        ),
        capturedAt: now,
      );

      await _db.appUsageDao.upsert(
        AppUsageEntriesCompanion.insert(
          id: model.id,
          deviceId: model.deviceId,
          packageName: model.packageName,
          appName: model.appName,
          usageDurationMs: model.usageDurationMs,
          lastUsed: model.lastUsed,
          capturedAt: model.capturedAt,
        ),
      );

      models.add(model);
    }

    appLogger.d('Captured usage for ${models.length} apps');
    return models;
  }

  Future<List<AppUsageEntry>> getTodayUsage() =>
      _db.appUsageDao.getForDate(DateTime.now());
}
