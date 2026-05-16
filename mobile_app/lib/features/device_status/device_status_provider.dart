import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/utils/device_id.dart';
import '../../models/device_status_model.dart';
import '../../storage/database_provider.dart';
import 'device_status_service.dart';

final deviceStatusServiceProvider = Provider<DeviceStatusService>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return DeviceStatusService(db);
}, name: 'deviceStatusService');

final deviceStatusProvider =
    FutureProvider<DeviceStatusModel?>((ref) async {
  final svc = ref.watch(deviceStatusServiceProvider);
  final deviceId = await DeviceIdUtil.get();
  return svc.getLatest(deviceId);
}, name: 'deviceStatus');

final captureDeviceStatusProvider = FutureProvider<void>((ref) async {
  final svc = ref.watch(deviceStatusServiceProvider);
  final deviceId = await DeviceIdUtil.get();
  await svc.captureAndStore(deviceId);
  ref.invalidate(deviceStatusProvider);
}, name: 'captureDeviceStatus');
