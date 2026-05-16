import 'package:drift/drift.dart';

/// Persists every GPS fix captured by the tracking service.
class LocationEntries extends Table {
  TextColumn get id => text()();
  TextColumn get deviceId => text()();
  RealColumn get latitude => real()();
  RealColumn get longitude => real()();
  RealColumn get accuracy => real()();
  RealColumn get altitude => real()();
  RealColumn get speed => real()();
  RealColumn get heading => real()();
  TextColumn get provider => text()();
  DateTimeColumn get capturedAt => dateTime()();
  BoolColumn get synced =>
      boolean().withDefault(const Constant(false))();
  TextColumn get address => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}
