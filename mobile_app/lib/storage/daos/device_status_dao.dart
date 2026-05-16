import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/device_status_entries.dart';

part 'device_status_dao.g.dart';

@DriftAccessor(tables: [DeviceStatusEntries])
class DeviceStatusDao extends DatabaseAccessor<AppDatabase>
    with _$DeviceStatusDaoMixin {
  DeviceStatusDao(super.db);

  Future<void> upsert(DeviceStatusEntriesCompanion entry) =>
      into(deviceStatusEntries).insertOnConflictUpdate(entry);

  Future<List<DeviceStatusEntry>> getUnsynced({int limit = 50}) =>
      (select(deviceStatusEntries)
            ..where((t) => t.synced.equals(false))
            ..orderBy([(t) => OrderingTerm.asc(t.capturedAt)])
            ..limit(limit))
          .get();

  Future<void> markSynced(List<String> ids) =>
      (update(deviceStatusEntries)..where((t) => t.id.isIn(ids)))
          .write(const DeviceStatusEntriesCompanion(synced: Value(true)));

  Future<DeviceStatusEntry?> getLatest() =>
      (select(deviceStatusEntries)
            ..orderBy([(t) => OrderingTerm.desc(t.capturedAt)])
            ..limit(1))
          .getSingleOrNull();

  Future<int> deleteOlderThan(DateTime cutoff) =>
      (delete(deviceStatusEntries)
            ..where((t) => t.capturedAt.isSmallerThanValue(cutoff)))
          .go();
}
