import 'package:drift/drift.dart';

/// One row = one app's usage snapshot for a given capture window.
class AppUsageEntries extends Table {
  TextColumn get id => text()();
  TextColumn get deviceId => text()();
  TextColumn get packageName => text()();
  TextColumn get appName => text()();
  IntColumn get usageDurationMs => integer()();
  DateTimeColumn get lastUsed => dateTime()();
  DateTimeColumn get capturedAt => dateTime()();
  BoolColumn get synced =>
      boolean().withDefault(const Constant(false))();
  TextColumn get category => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}
