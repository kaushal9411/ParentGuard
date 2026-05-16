import 'package:battery_plus/battery_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';
import '../../core/utils/logger.dart';
import '../../models/device_status_model.dart';
import '../../storage/app_database.dart';
import '../../storage/tables/device_status_entries.dart';

class DeviceStatusService {
  DeviceStatusService(this._db);

  final AppDatabase _db;
  final _battery = Battery();
  final _connectivity = Connectivity();
  final _uuid = const Uuid();

  Future<DeviceStatusModel> captureAndStore(String deviceId) async {
    final level = await _battery.batteryLevel;
    final state = await _battery.batteryState;
    final results = await _connectivity.checkConnectivity();

    final isConnected = results.any((r) =>
        r == ConnectivityResult.mobile || r == ConnectivityResult.wifi);

    String networkType = 'none';
    if (results.contains(ConnectivityResult.wifi)) {
      networkType = 'wifi';
    } else if (results.contains(ConnectivityResult.mobile)) {
      networkType = 'mobile';
    } else if (results.contains(ConnectivityResult.ethernet)) {
      networkType = 'ethernet';
    }

    final model = DeviceStatusModel(
      id: _uuid.v4(),
      deviceId: deviceId,
      batteryLevel: level,
      isCharging: state == BatteryState.charging || state == BatteryState.full,
      networkType: networkType,
      isConnected: isConnected,
      capturedAt: DateTime.now(),
    );

    await _db.deviceStatusDao.upsert(
      DeviceStatusEntriesCompanion.insert(
        id: model.id,
        deviceId: model.deviceId,
        batteryLevel: model.batteryLevel,
        isCharging: model.isCharging,
        networkType: model.networkType,
        isConnected: model.isConnected,
        capturedAt: model.capturedAt,
      ),
    );

    appLogger.d(
      'Device status: battery=${model.batteryLevel}% '
      'charging=${model.isCharging} net=${model.networkType}',
    );
    return model;
  }

  Future<DeviceStatusModel?> getLatest(String deviceId) async {
    final entry = await _db.deviceStatusDao.getLatest();
    if (entry == null) return null;
    return DeviceStatusModel(
      id: entry.id,
      deviceId: entry.deviceId,
      batteryLevel: entry.batteryLevel,
      isCharging: entry.isCharging,
      networkType: entry.networkType,
      isConnected: entry.isConnected,
      capturedAt: entry.capturedAt,
      synced: entry.synced,
      wifiSsid: entry.wifiSsid,
      signalStrength: entry.signalStrength,
    );
  }
}
