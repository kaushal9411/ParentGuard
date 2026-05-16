import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/event_queue_entries.dart';

part 'event_queue_dao.g.dart';

@DriftAccessor(tables: [EventQueueEntries])
class EventQueueDao extends DatabaseAccessor<AppDatabase>
    with _$EventQueueDaoMixin {
  EventQueueDao(super.db);

  Future<void> enqueue(EventQueueEntriesCompanion entry) =>
      into(eventQueueEntries).insert(entry);

  Future<List<EventQueueEntry>> getPending({int limit = 50}) =>
      (select(eventQueueEntries)
            ..where((t) => t.status.equals('pending'))
            ..orderBy([(t) => OrderingTerm.asc(t.createdAt)])
            ..limit(limit))
          .get();

  Future<void> updateStatus(
    String id,
    String status, {
    int? retryCount,
    String? errorMessage,
  }) =>
      (update(eventQueueEntries)..where((t) => t.id.equals(id))).write(
        EventQueueEntriesCompanion(
          status: Value(status),
          lastAttemptAt: Value(DateTime.now()),
          retryCount:
              retryCount != null ? Value(retryCount) : const Value.absent(),
          errorMessage: errorMessage != null
              ? Value(errorMessage)
              : const Value.absent(),
        ),
      );

  Future<int> deleteCompleted() =>
      (delete(eventQueueEntries)
            ..where((t) => t.status.equals('completed')))
          .go();

  Future<int> deleteDeadLetters() =>
      (delete(eventQueueEntries)
            ..where((t) => t.status.equals('deadLetter')))
          .go();

  Future<int> countPending() async {
    final count =
        countAll(filter: eventQueueEntries.status.equals('pending'));
    final row = await (selectOnly(eventQueueEntries)..addColumns([count]))
        .getSingle();
    return row.read(count) ?? 0;
  }

  /// Reset failed events that still have retries left back to pending.
  Future<void> requeueFailed(int maxRetries) => customUpdate(
        '''UPDATE event_queue_entries
           SET status = 'pending'
           WHERE status = 'failed' AND retry_count < $maxRetries''',
        updates: {eventQueueEntries},
      );
}
