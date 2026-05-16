import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/location_entries.dart';

part 'location_dao.g.dart';

@DriftAccessor(tables: [LocationEntries])
class LocationDao extends DatabaseAccessor<AppDatabase>
    with _$LocationDaoMixin {
  LocationDao(super.db);

  Future<void> upsert(LocationEntriesCompanion entry) =>
      into(locationEntries).insertOnConflictUpdate(entry);

  Future<List<LocationEntry>> getUnsynced({int limit = 50}) =>
      (select(locationEntries)
            ..where((t) => t.synced.equals(false))
            ..orderBy([(t) => OrderingTerm.asc(t.capturedAt)])
            ..limit(limit))
          .get();

  Future<void> markSynced(List<String> ids) =>
      (update(locationEntries)..where((t) => t.id.isIn(ids)))
          .write(const LocationEntriesCompanion(synced: Value(true)));

  Future<List<LocationEntry>> getRecent({int limit = 100}) =>
      (select(locationEntries)
            ..orderBy([(t) => OrderingTerm.desc(t.capturedAt)])
            ..limit(limit))
          .get();

  Future<int> deleteOlderThan(DateTime cutoff) =>
      (delete(locationEntries)
            ..where((t) => t.capturedAt.isSmallerThanValue(cutoff)))
          .go();
}
