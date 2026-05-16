import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/utils/device_id.dart';
import '../../storage/app_database.dart';
import '../../storage/database_provider.dart';
import 'location_service.dart';

final locationServiceProvider = Provider<LocationService>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return LocationService(db);
}, name: 'locationService');

final recentLocationsProvider =
    FutureProvider<List<LocationEntry>>((ref) async {
  final db = ref.watch(appDatabaseProvider);
  return db.locationDao.getRecent(limit: 50);
}, name: 'recentLocations');

final captureLocationProvider = FutureProvider<void>((ref) async {
  final svc = ref.watch(locationServiceProvider);
  final deviceId = await DeviceIdUtil.get();
  await svc.captureAndStore(deviceId);
  ref.invalidate(recentLocationsProvider);
}, name: 'captureLocation');
