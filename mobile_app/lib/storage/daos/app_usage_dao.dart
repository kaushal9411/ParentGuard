import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/app_usage_entries.dart';

part 'app_usage_dao.g.dart';

@DriftAccessor(tables: [AppUsageEntries])
class AppUsageDao extends DatabaseAccessor<AppDatabase>
    with _$AppUsageDaoMixin {
  AppUsageDao(super.db);

  Future<void> upsert(AppUsageEntriesCompanion entry) =>
      into(appUsageEntries).insertOnConflictUpdate(entry);

  Future<List<AppUsageEntry>> getUnsynced({int limit = 50}) =>
      (select(appUsageEntries)
            ..where((t) => t.synced.equals(false))
            ..orderBy([(t) => OrderingTerm.asc(t.capturedAt)])
            ..limit(limit))
          .get();

  Future<void> markSynced(List<String> ids) =>
      (update(appUsageEntries)..where((t) => t.id.isIn(ids)))
          .write(const AppUsageEntriesCompanion(synced: Value(true)));

  Future<List<AppUsageEntry>> getForDate(DateTime date) {
    final start = DateTime(date.year, date.month, date.day);
    final end = start.add(const Duration(days: 1));
    return (select(appUsageEntries)
          ..where(
            (t) =>
                t.capturedAt.isBiggerOrEqualValue(start) &
                t.capturedAt.isSmallerThanValue(end),
          )
          ..orderBy([(t) => OrderingTerm.desc(t.usageDurationMs)]))
        .get();
  }

  Future<int> deleteOlderThan(DateTime cutoff) =>
      (delete(appUsageEntries)
            ..where((t) => t.capturedAt.isSmallerThanValue(cutoff)))
          .go();
}
