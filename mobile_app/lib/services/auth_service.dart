import 'package:dio/dio.dart';
import '../core/utils/device_id.dart';
import '../core/utils/token_store.dart';
import '../core/errors/app_exceptions.dart';

class AuthResult {
  const AuthResult({
    required this.token,
    required this.userId,
    required this.role,
    required this.name,
    required this.email,
  });

  final String token;
  final String userId;
  final String role;
  final String name;
  final String email;
}

class AuthService {
  AuthService(this._baseUrl);

  final String _baseUrl;

  late final Dio _dio = Dio(BaseOptions(
    baseUrl: _baseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 15),
  ));

  // ── Register ────────────────────────────────────────────────────────────────

  Future<AuthResult> register({
    required String name,
    required String email,
    required String password,
    required String deviceName,
    required String deviceRole, // 'Child Monitor' | 'Parent'
  }) async {
    final deviceId = await DeviceIdUtil.get();
    try {
      final resp = await _dio.post('/api/auth/register', data: {
        'name': name,
        'email': email,
        'password': password,
        'deviceId': deviceId,
        'deviceName': deviceName,
        'deviceRole': deviceRole == 'Parent' ? 'parent' : 'child',
      });

      final result = AuthResult(
        token: resp.data['token'] as String,
        userId: resp.data['userId'] as String,
        role: resp.data['role'] as String,
        name: resp.data['name'] as String? ?? name,
        email: resp.data['email'] as String? ?? email,
      );

      await TokenStore.save(
        token: result.token,
        userId: result.userId,
        role: result.role,
      );

      return result;
    } on DioException catch (e) {
      throw SyncException(_extractError(e, 'Registration failed'));
    }
  }

  // ── Login ───────────────────────────────────────────────────────────────────

  Future<AuthResult> login({
    required String email,
    required String password,
  }) async {
    final deviceId = await DeviceIdUtil.get();
    try {
      final resp = await _dio.post('/api/auth/login', data: {
        'email': email,
        'password': password,
        'deviceId': deviceId,
      });

      final result = AuthResult(
        token: resp.data['token'] as String,
        userId: resp.data['userId'] as String,
        role: resp.data['role'] as String,
        name: resp.data['name'] as String? ?? '',
        email: resp.data['email'] as String? ?? email,
      );

      await TokenStore.save(
        token: result.token,
        userId: result.userId,
        role: result.role,
      );

      return result;
    } on DioException catch (e) {
      throw SyncException(_extractError(e, 'Login failed'));
    }
  }

  // ── Verify stored token is still valid ──────────────────────────────────────

  Future<bool> validateToken() async {
    final token = await TokenStore.getToken();
    if (token == null) return false;
    try {
      await _dio.get(
        '/api/auth/me',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      return true;
    } catch (_) {
      await TokenStore.clear();
      return false;
    }
  }

  // ── Logout ──────────────────────────────────────────────────────────────────

  Future<void> logout() async {
    final deviceId = await DeviceIdUtil.get();
    final token = await TokenStore.getToken();
    try {
      await _dio.post(
        '/api/auth/logout',
        data: {'deviceId': deviceId},
        options: Options(headers: {'Authorization': 'Bearer ${token ?? ''}'}),
      );
    } catch (_) {
      // Best-effort — always clear local token
    }
    await TokenStore.clear();
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  String _extractError(DioException e, String fallback) {
    final data = e.response?.data;
    if (data is Map) {
      final err = data['error'];
      if (err is String) return err;
      if (err is Map) {
        // Zod fieldErrors — flatten to first message
        final first = (err.values.first as List?)?.first as String?;
        return first ?? fallback;
      }
    }
    return e.message ?? fallback;
  }
}
