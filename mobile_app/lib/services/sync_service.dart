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
    receiveTimeout: const Duration(seconds: 20),
  ));

  bool _busy = false;

  Future<void> sync() async {
    if (_busy) return;
    _busy = true;

    try {
      await _queue.requeueFailed();
      final batch = await _queue.getPendingBatch();

      if (batch.isEmpty) {
        appLogger.d('Sync: queue empty');
        return;
      }

      appLogger.i('Sync: uploading ${batch.length} events');

      final token = await TokenStore.getToken();
      if (token == null) {
        appLogger.w('Sync: no auth token — skipping upload');
        return;
      }

      final deviceId = await DeviceIdUtil.get();

      final payload = {
        'deviceId': deviceId,
        'events': batch.map((e) => {
          'id': e.id,
          'type': e.eventType,
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
        final failed = resp.data['failed'] as int? ?? 0;
        appLogger.i('Sync: server accepted $processed, rejected $failed');

        for (final event in batch) {
          await _queue.markCompleted(event.id);
        }
      } on DioException catch (e) {
        appLogger.w('Sync: batch upload failed — ${e.message}');
        for (final event in batch) {
          await _queue.markFailed(event.id, e.message ?? 'network', event.retryCount + 1);
        }
        return;
      }

      await _queue.cleanup();
      appLogger.i('Sync: done (${batch.length} events)');
    } finally {
      _busy = false;
    }
  }
}
