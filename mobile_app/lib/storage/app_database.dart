import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

import 'tables/location_entries.dart';
import 'tables/app_usage_entries.dart';
import 'tables/notification_entries.dart';
import 'tables/device_status_entries.dart';
import 'tables/event_queue_entries.dart';
import 'daos/location_dao.dart';
import 'daos/app_usage_dao.dart';
import 'daos/notification_dao.dart';
import 'daos/device_status_dao.dart';
import 'daos/event_queue_dao.dart';

part 'app_database.g.dart';

@DriftDatabase(
  tables: [
    LocationEntries,
    AppUsageEntries,
    NotificationEntries,
    DeviceStatusEntries,
    EventQueueEntries,
  ],
  daos: [
    LocationDao,
    AppUsageDao,
    NotificationDao,
    DeviceStatusDao,
    EventQueueDao,
  ],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase([QueryExecutor? e]) : super(e ?? _openConnection());

  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) => m.createAll(),
        onUpgrade: (m, from, to) async {
          // Add migration steps here when bumping schemaVersion.
        },
      );

  static QueryExecutor _openConnection() =>
      driftDatabase(name: 'parental_monitor');
}
