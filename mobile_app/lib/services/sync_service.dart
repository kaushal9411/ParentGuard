import 'dart:convert';
import 'package:dio/dio.dart';
import '../core/constants/app_constants.dart';
import '../core/utils/device_id.dart';
import '../core/utils/logger.dart';
import '../core/utils/token_store.dart';
import '../storage/app_database.dart';
import 'event_queue_service.dart';

class SyncService {
  SyncService(this._db, this._queue, {String? baseUrl})
      : _baseUrl = baseUrl ?? AppConstants.backendBaseUrl;

  final AppDatabase _db;
  final EventQueueService _queue;
  final String _baseUrl;

  late final Dio _dio = Dio(BaseOptions(
    baseUrl: _baseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 30),
  ));

  bool _busy = false;

  /// Drains the ENTIRE event queue to the backend, batch by batch.
  /// Stops on the first network error so the remaining events are retried
  /// on the next call.
  Future<void> sync() async {
    if (_busy) return;
    _busy = true;

    try {
      // Move previously-failed events (retry_count < max) back to pending.
      await _queue.requeueFailed();

      final token = await TokenStore.getToken();
      if (token == null) {
        appLogger.w('Sync: no auth token — skipping upload');
        return;
      }
      final deviceId = await DeviceIdUtil.get();

      int totalSent = 0;

      // Loop until the queue is empty — don't leave events stranded behind
      // a large backlog of earlier events.
      while (true) {
        final batch = await _queue.getPendingBatch();
        if (batch.isEmpty) break;

        appLogger.i('Sync: uploading ${batch.length} events');

        final payload = {
          'deviceId': deviceId,
          'events': batch.map((e) => {
            'id':      e.id,
            'type':    e.eventType,
            'payload': jsonDecode(e.payloadJson) as Map<String, dynamic>,
          }).toList(),
        };

        try {
          final resp = await _dio.post(
            '/api/events/batch',
            data: payload,
            options: Options(headers: {'Authorization': 'Bearer $token'}),
          );

          final processed = resp.data['processed'] as int? ?? 0;
          final failed    = resp.data['failed']    as int? ?? 0;

          if (failed > 0) {
            appLogger.w('Sync: backend rejected $failed/${batch.length} events');
          }

          // Mark all events in this batch completed. The backend logs
          // individual failures with the event ID for server-side debugging.
          for (final event in batch) {
            await _queue.markCompleted(event.id);
          }

          totalSent += processed;
        } on DioException catch (e) {
          appLogger.w('Sync: batch upload failed — ${e.message}');
          for (final event in batch) {
            await _queue.markFailed(
              event.id, e.message ?? 'network', event.retryCount + 1);
          }
          break; // stop looping; retry on next captureAllAndSync
        }
      }

      await _queue.cleanup();
      if (totalSent > 0) {
        appLogger.i('Sync: done — $totalSent events accepted by backend');
      }
    } finally {
      _busy = false;
    }
  }
}
