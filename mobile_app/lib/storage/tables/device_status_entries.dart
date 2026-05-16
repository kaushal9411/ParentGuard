import 'package:drift/drift.dart';

/// Periodic snapshot of battery + connectivity state.
class DeviceStatusEntries extends Table {
  TextColumn get id => text()();
  TextColumn get deviceId => text()();
  IntColumn get batteryLevel => integer()();
  BoolColumn get isCharging => boolean()();
  TextColumn get networkType => text()();
  BoolColumn get isConnected => boolean()();
  DateTimeColumn get capturedAt => dateTime()();
  BoolColumn get synced =>
      boolean().withDefault(const Constant(false))();
  TextColumn get wifiSsid => text().nullable()();
  IntColumn get signalStrength => integer().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}
