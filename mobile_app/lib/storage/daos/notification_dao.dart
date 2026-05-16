import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/notification_entries.dart';

part 'notification_dao.g.dart';

@DriftAccessor(tables: [NotificationEntries])
class NotificationDao extends DatabaseAccessor<AppDatabase>
    with _$NotificationDaoMixin {
  NotificationDao(super.db);

  Future<void> upsert(NotificationEntriesCompanion entry) =>
      into(notificationEntries).insertOnConflictUpdate(entry);

  Future<List<NotificationEntry>> getUnsynced({int limit = 50}) =>
      (select(notificationEntries)
            ..where((t) => t.synced.equals(false))
            ..orderBy([(t) => OrderingTerm.asc(t.postedAt)])
            ..limit(limit))
          .get();

  Future<void> markSynced(List<String> ids) =>
      (update(notificationEntries)..where((t) => t.id.isIn(ids)))
          .write(const NotificationEntriesCompanion(synced: Value(true)));

  Future<List<NotificationEntry>> getRecent({int limit = 200}) =>
      (select(notificationEntries)
            ..orderBy([(t) => OrderingTerm.desc(t.postedAt)])
            ..limit(limit))
          .get();

  Future<int> deleteOlderThan(DateTime cutoff) =>
      (delete(notificationEntries)
            ..where((t) => t.postedAt.isSmallerThanValue(cutoff)))
          .go();
}
