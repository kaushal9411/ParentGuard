import 'dart:convert';
import 'package:flutter/services.dart';
import '../core/constants/channel_constants.dart';
import '../core/errors/app_exceptions.dart';

/// Singleton bridge to all native Android method channels.
///
/// Channel layout:
///   com.parentalmonitor/tracking   → foreground service lifecycle
///   com.parentalmonitor/location   → one-shot location reads
///   com.parentalmonitor/usage      → UsageStatsManager
///   com.parentalmonitor/device     → battery + device info + settings intents
///   com.parentalmonitor/monitoring → call logs, contacts, gallery, browsing, app blocks
class TrackingChannel {
  TrackingChannel._();
  static final TrackingChannel instance = TrackingChannel._();

  static const _tracking =
      MethodChannel(ChannelConstants.trackingChannel);
  static const _location =
      MethodChannel(ChannelConstants.locationChannel);
  static const _usage =
      MethodChannel(ChannelConstants.usageChannel);
  static const _device =
      MethodChannel(ChannelConstants.deviceChannel);
  static const _monitoring =
      MethodChannel(ChannelConstants.monitoringChannel);

  // ── Foreground service ────────────────────────────────────────────────────

  Future<bool> startTrackingService() => _invoke<bool>(
        _tracking, ChannelConstants.startTracking,
      ).then((v) => v ?? false);

  Future<bool> stopTrackingService() => _invoke<bool>(
        _tracking, ChannelConstants.stopTracking,
      ).then((v) => v ?? false);

  Future<bool> isTrackingActive() => _invoke<bool>(
        _tracking, ChannelConstants.isTrackingActive,
      ).then((v) => v ?? false);

  // ── Location ──────────────────────────────────────────────────────────────

  /// Returns a map: {latitude, longitude, accuracy, altitude, speed, bearing,
  ///                  provider, timestamp}
  Future<Map<String, dynamic>> getLocation() async {
    final raw = await _invoke<String>(_location, ChannelConstants.getLocation);
    if (raw == null) throw const LocationException('Null location from native');
    return jsonDecode(raw) as Map<String, dynamic>;
  }

  // ── App usage ─────────────────────────────────────────────────────────────

  Future<bool> hasUsagePermission() => _invoke<bool>(
        _usage, ChannelConstants.hasUsagePermission,
      ).then((v) => v ?? false);

  Future<void> requestUsagePermission() =>
      _invoke<void>(_usage, ChannelConstants.requestUsagePermission);

  /// Returns JSON list of {packageName, appName, usageDurationMs, lastUsed}.
  Future<List<Map<String, dynamic>>> getUsageStats({
    required DateTime from,
    required DateTime to,
  }) async {
    final raw = await _invoke<String>(
      _usage,
      ChannelConstants.getUsageStats,
      {'from': from.millisecondsSinceEpoch, 'to': to.millisecondsSinceEpoch},
    );
    if (raw == null) return [];
    return (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
  }

  /// Returns JSON list of {packageName, appName}.
  Future<List<Map<String, dynamic>>> getInstalledApps() async {
    final raw =
        await _invoke<String>(_usage, ChannelConstants.getInstalledApps);
    if (raw == null) return [];
    return (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
  }

  // ── Device ────────────────────────────────────────────────────────────────

  /// Returns {level, isCharging, status}
  Future<Map<String, dynamic>> getBatteryStatus() async {
    final raw =
        await _invoke<String>(_device, ChannelConstants.getBatteryStatus);
    if (raw == null) throw const DeviceInfoException('Null battery status');
    return jsonDecode(raw) as Map<String, dynamic>;
  }

  /// Returns {model, manufacturer, androidVersion, androidSdk}
  Future<Map<String, dynamic>> getDeviceInfo() async {
    final raw =
        await _invoke<String>(_device, ChannelConstants.getDeviceInfo);
    if (raw == null) throw const DeviceInfoException('Null device info');
    return jsonDecode(raw) as Map<String, dynamic>;
  }

  Future<void> openNotificationSettings() =>
      _invoke<void>(_device, ChannelConstants.openNotificationSettings);

  Future<bool> isNotificationAccessGranted() => _invoke<bool>(
        _device, ChannelConstants.isNotificationAccessGranted,
      ).then((v) => v ?? false);

  Future<void> openBatterySettings() =>
      _invoke<void>(_device, ChannelConstants.openBatterySettings);

  // ── Monitoring ────────────────────────────────────────────────────────────

  /// Returns list of call log entries since [sinceTimestamp] ms epoch.
  Future<List<Map<String, dynamic>>> getCallLogs({int sinceTimestamp = 0}) async {
    final raw = await _invoke<String>(
      _monitoring,
      ChannelConstants.getCallLogs,
      {'sinceTimestamp': sinceTimestamp},
    );
    if (raw == null) return [];
    return (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
  }

  /// Returns all device contacts.
  Future<List<Map<String, dynamic>>> getContacts() async {
    final raw = await _invoke<String>(_monitoring, ChannelConstants.getContacts);
    if (raw == null) return [];
    return (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
  }

  /// Returns gallery items (images + videos) added since [sinceTimestamp] ms epoch.
  Future<List<Map<String, dynamic>>> getGalleryItems({int sinceTimestamp = 0}) async {
    final raw = await _invoke<String>(
      _monitoring,
      ChannelConstants.getGalleryItems,
      {'sinceTimestamp': sinceTimestamp},
    );
    if (raw == null) return [];
    return (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
  }

  /// Reads the actual image from the device and returns base64 JPEG (up to 1920px).
  /// Returns empty string if the file cannot be read.
  Future<String> getGalleryImageData(String itemId) async {
    final raw = await _invoke<String>(
      _monitoring,
      ChannelConstants.getGalleryImageData,
      {'itemId': itemId},
    );
    return raw ?? '';
  }

  /// Reads the actual video file from the device and returns raw bytes as base64.
  /// Returns empty string if the file is too large (>50 MB) or cannot be read.
  Future<String> getGalleryVideoData(String itemId) async {
    final raw = await _invoke<String>(
      _monitoring,
      ChannelConstants.getGalleryVideoData,
      {'itemId': itemId},
    );
    return raw ?? '';
  }

  /// Returns pending notifications captured by the native listener and clears the queue.
  Future<List<Map<String, dynamic>>> getNotifications() async {
    final raw = await _invoke<String>(_monitoring, ChannelConstants.getNotifications);
    if (raw == null) return [];
    return (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
  }

  /// Returns browser history entries since [sinceTimestamp] ms epoch.
  Future<List<Map<String, dynamic>>> getBrowsingHistory({int sinceTimestamp = 0}) async {
    final raw = await _invoke<String>(
      _monitoring,
      ChannelConstants.getBrowsingHistory,
      {'sinceTimestamp': sinceTimestamp},
    );
    if (raw == null) return [];
    return (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
  }

  /// Pushes updated blocked-app package list to native SharedPreferences.
  Future<void> updateBlockedApps(List<String> packages) =>
      _invoke<void>(_monitoring, ChannelConstants.updateBlockedApps, {'packages': packages});

  /// Returns the geofence zones JSON string stored by the native service.
  Future<String> getStoredGeofences() async {
    final raw = await _invoke<String>(_monitoring, ChannelConstants.getStoredGeofences);
    return raw ?? '[]';
  }

  // ── Internal helper ───────────────────────────────────────────────────────

  Future<T?> _invoke<T>(
    MethodChannel channel,
    String method, [
    Object? args,
  ]) async {
    try {
      return await channel.invokeMethod<T>(method, args);
    } on PlatformException catch (e) {
      throw PlatformChannelException('$method failed: ${e.message}');
    }
  }
}
