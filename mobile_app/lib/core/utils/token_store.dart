import 'package:shared_preferences/shared_preferences.dart';

/// Persists the JWT, userId, and deviceId between app restarts.
///
/// Key naming: Flutter SharedPreferences stores keys with a "flutter." prefix
/// when accessed from native Android code (FlutterSharedPreferences).
/// The Kotlin native services read:
///   flutter.pm_token     → _keyToken
///   flutter.pm_device_id → _keyDeviceId
class TokenStore {
  // These keys must stay in sync with the Kotlin native service reads.
  static const _keyToken    = 'pm_token';      // Kotlin reads flutter.pm_token
  static const _keyUserId   = 'pm_user_id';
  static const _keyRole     = 'pm_user_role';
  static const _keyDeviceId = 'pm_device_id';  // Kotlin reads flutter.pm_device_id

  static Future<void> save({
    required String token,
    required String userId,
    required String role,
    String? deviceId,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyToken,  token);
    await prefs.setString(_keyUserId, userId);
    await prefs.setString(_keyRole,   role);
    if (deviceId != null) await prefs.setString(_keyDeviceId, deviceId);
  }

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyToken);
  }

  static Future<String?> getUserId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyUserId);
  }

  static Future<String?> getRole() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyRole);
  }

  static Future<String?> getDeviceId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyDeviceId);
  }

  static Future<bool> isLoggedIn() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyToken);
    await prefs.remove(_keyUserId);
    await prefs.remove(_keyRole);
    // Keep deviceId — it's hardware-derived and valid across sessions
  }
}
