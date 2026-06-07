import 'package:flutter/services.dart';

/// Manages app launcher icon visibility for stealth mode
class LauncherChannel {
  static const platform = MethodChannel('com.parental_monitor.app/launcher');

  /// Hide app icon from launcher (stealth mode)
  static Future<bool> hideAppIcon() async {
    try {
      final result = await platform.invokeMethod<bool>('hideIcon');
      return result ?? false;
    } on PlatformException catch (e) {
      print('Failed to hide icon: ${e.message}');
      return false;
    }
  }

  /// Show app icon in launcher
  static Future<bool> showAppIcon() async {
    try {
      final result = await platform.invokeMethod<bool>('showIcon');
      return result ?? false;
    } on PlatformException catch (e) {
      print('Failed to show icon: ${e.message}');
      return false;
    }
  }

  /// Check if app icon is currently hidden
  static Future<bool> isIconHidden() async {
    try {
      final result = await platform.invokeMethod<bool>('isIconHidden');
      return result ?? false;
    } on PlatformException catch (e) {
      print('Failed to check icon status: ${e.message}');
      return false;
    }
  }

  /// Hide app completely: hides icon, silences the service notification,
  /// and moves the app to background. Background sync keeps running.
  static Future<bool> hideApp() async {
    try {
      final result = await platform.invokeMethod<bool>('hideApp');
      return result ?? false;
    } catch (e) {
      print('Failed to hide app: $e');
      return false;
    }
  }
}
