import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/utils/device_id.dart';
import '../../storage/app_database.dart';
import '../../storage/database_provider.dart';
import 'usage_tracking_service.dart';

final usageTrackingServiceProvider = Provider<UsageTrackingService>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return UsageTrackingService(db);
}, name: 'usageTrackingService');

final todayUsageProvider =
    FutureProvider<List<AppUsageEntry>>((ref) async {
  final db = ref.watch(appDatabaseProvider);
  return db.appUsageDao.getForDate(DateTime.now());
}, name: 'todayUsage');

final captureUsageProvider = FutureProvider<void>((ref) async {
  final svc = ref.watch(usageTrackingServiceProvider);
  final deviceId = await DeviceIdUtil.get();
  await svc.captureAndStore(deviceId);
  ref.invalidate(todayUsageProvider);
}, name: 'captureUsage');
