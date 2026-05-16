import 'dart:convert';
import 'package:uuid/uuid.dart';
import '../core/constants/app_constants.dart';
import '../core/utils/logger.dart';
import '../models/event_queue_model.dart';
import '../storage/app_database.dart';
import '../storage/tables/event_queue_entries.dart';

class EventQueueService {
  EventQueueService(this._db);

  final AppDatabase _db;
  final _uuid = const Uuid();

  Future<void> enqueue(EventType type, Map<String, dynamic> payload) async {
    final pending = await _db.eventQueueDao.countPending();
    if (pending >= AppConstants.maxQueueSize) {
      appLogger.w('Event queue at capacity ($pending) — purging oldest batch');
      await _pruneOldest();
    }

    await _db.eventQueueDao.enqueue(
      EventQueueEntriesCompanion.insert(
        id: _uuid.v4(),
        eventType: type.name,
        payloadJson: jsonEncode(payload),
        createdAt: DateTime.now(),
      ),
    );
  }

  Future<List<EventQueueEntry>> getPendingBatch() =>
      _db.eventQueueDao.getPending(limit: AppConstants.syncBatchSize);

  Future<void> markCompleted(String id) =>
      _db.eventQueueDao.updateStatus(id, EventStatus.completed.name);

  Future<void> markFailed(String id, String error, int attempts) =>
      _db.eventQueueDao.updateStatus(
        id,
        attempts >= AppConstants.maxRetryAttempts
            ? EventStatus.deadLetter.name
            : EventStatus.failed.name,
        retryCount: attempts,
        errorMessage: error,
      );

  Future<void> requeueFailed() =>
      _db.eventQueueDao.requeueFailed(AppConstants.maxRetryAttempts);

  Future<void> cleanup() => _db.eventQueueDao.deleteCompleted();

  Future<void> _pruneOldest() => _db.customUpdate(
        '''DELETE FROM event_queue_entries
           WHERE id IN (
             SELECT id FROM event_queue_entries
             WHERE status = 'pending'
             ORDER BY created_at ASC LIMIT 100
           )''',
        updates: {_db.eventQueueEntries},
      );
}
