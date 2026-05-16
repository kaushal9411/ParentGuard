import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';
import '../core/utils/logger.dart';
import '../platform/tracking_channel.dart';

class PermissionService {
  const PermissionService();

  /// Requests all permissions needed for core tracking.
  /// Returns true only if every required permission is granted.
  Future<bool> requestEssentialPermissions() async {
    // Step 1: foreground location (must precede background location request)
    final fgLocation = await Permission.locationWhenInUse.request();
    if (!fgLocation.isGranted) {
      appLogger.w('Foreground location denied');
      return false;
    }

    // Step 2: background location (Android 10+: separate dialog/settings)
    final bgLocation = await Permission.locationAlways.request();
    if (!bgLocation.isGranted) {
      appLogger.w('Background location denied — tracking will be partial');
    }

    // Step 3: battery optimisation exemption
    final battery = await Permission.ignoreBatteryOptimizations.request();
    if (!battery.isGranted) {
      appLogger.w('Battery optimisation not exempted');
    }

    // Step 4: notification permission (Android 13+)
    await Permission.notification.request();

    return fgLocation.isGranted;
  }

  Future<bool> isBackgroundLocationGranted() =>
      Permission.locationAlways.isGranted;

  Future<bool> isNotificationGranted() =>
      Permission.notification.isGranted;

  Future<bool> isNotificationAccessGranted() =>
      TrackingChannel.instance.isNotificationAccessGranted();

  Future<void> openNotificationAccessSettings() =>
      TrackingChannel.instance.openNotificationSettings();

  Future<bool> hasUsageStatsPermission() =>
      TrackingChannel.instance.hasUsagePermission();

  Future<void> openUsageStatsSettings() =>
      TrackingChannel.instance.requestUsagePermission();

  Future<void> openAppSettings() => openAppSettings();
}

final permissionServiceProvider = Provider<PermissionService>(
  (_) => const PermissionService(),
  name: 'permissionService',
);
