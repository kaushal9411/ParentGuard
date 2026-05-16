import 'package:device_info_plus/device_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import '../constants/app_constants.dart';

class DeviceIdUtil {
  DeviceIdUtil._();

  static String? _cached;

  static Future<String> get() async {
    if (_cached != null) return _cached!;

    final prefs = await SharedPreferences.getInstance();
    String? stored = prefs.getString(AppConstants.prefDeviceId);

    if (stored == null) {
      // Derive from Android ID if available, otherwise generate once
      try {
        final info = await DeviceInfoPlugin().androidInfo;
        stored = info.id; // stable across reboots
      } catch (_) {
        stored = const Uuid().v4();
      }
      await prefs.setString(AppConstants.prefDeviceId, stored);
    }

    _cached = stored;
    return stored;
  }
}
