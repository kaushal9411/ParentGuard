import 'package:drift/drift.dart';

/// Outbound sync queue. Every captured event is enqueued here and
/// drained by SyncService when a backend connection is available.
class EventQueueEntries extends Table {
  TextColumn get id => text()();

  /// Matches EventType enum name: location | appUsage | notification | deviceStatus
  TextColumn get eventType => text()();

  /// Full JSON-encoded payload for the event.
  TextColumn get payloadJson => text()();
  DateTimeColumn get createdAt => dateTime()();

  /// pending | inProgress | failed | deadLetter | completed
  TextColumn get status =>
      text().withDefault(const Constant('pending'))();
  IntColumn get retryCount =>
      integer().withDefault(const Constant(0))();
  DateTimeColumn get lastAttemptAt => dateTime().nullable()();
  TextColumn get errorMessage => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}
