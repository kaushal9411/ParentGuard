import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists login credentials for the "Remember me" checkbox on the login
/// page. Backed by platform secure storage (Android Keystore / iOS Keychain)
/// since — unlike the JWT in [TokenStore] — this holds the raw password.
class RememberMeStore {
  static const _storage = FlutterSecureStorage();

  static const _keyEmail    = 'remember_email';
  static const _keyPassword = 'remember_password';

  static Future<void> save({required String email, required String password}) async {
    await _storage.write(key: _keyEmail, value: email);
    await _storage.write(key: _keyPassword, value: password);
  }

  static Future<({String email, String password})?> load() async {
    final email    = await _storage.read(key: _keyEmail);
    final password = await _storage.read(key: _keyPassword);
    if (email == null || password == null) return null;
    return (email: email, password: password);
  }

  static Future<void> clear() async {
    await _storage.delete(key: _keyEmail);
    await _storage.delete(key: _keyPassword);
  }
}
