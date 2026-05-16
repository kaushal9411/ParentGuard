import 'package:drift/drift.dart';

/// One row = one notification posted on the device.
class NotificationEntries extends Table {
  TextColumn get id => text()();
  TextColumn get deviceId => text()();
  TextColumn get packageName => text()();
  TextColumn get appName => text()();
  TextColumn get title => text()();
  TextColumn get body => text()();
  DateTimeColumn get postedAt => dateTime()();
  BoolColumn get synced =>
      boolean().withDefault(const Constant(false))();
  TextColumn get category => text().nullable()();

  /// JSON-encoded extras map from the notification bundle.
  TextColumn get extrasJson => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}
