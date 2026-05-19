import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import '../core/constants/app_constants.dart';
import '../core/utils/token_store.dart';

/// Features included in the user's active subscription.
/// All fields default to the free-tier values.
class SubscriptionFeatures {
  final int     maxDevices;
  final bool    location;
  final bool    notifications;
  final bool    callLogs;
  final bool    contacts;
  final bool    appUsage;
  final bool    gallery;
  final bool    browsingHistory;
  final bool    geofencing;
  final bool    appBlocking;
  final bool    remoteCommands;
  final int     historyDays;

  const SubscriptionFeatures({
    this.maxDevices      = 1,
    this.location        = true,
    this.notifications   = true,
    this.callLogs        = false,
    this.contacts        = false,
    this.appUsage        = false,
    this.gallery         = false,
    this.browsingHistory = false,
    this.geofencing      = false,
    this.appBlocking     = false,
    this.remoteCommands  = false,
    this.historyDays     = 7,
  });

  static const free = SubscriptionFeatures();

  factory SubscriptionFeatures.fromJson(Map<String, dynamic> j) =>
      SubscriptionFeatures(
        maxDevices:      (j['maxDevices']      as int?)  ?? 1,
        location:        (j['location']        as bool?) ?? true,
        notifications:   (j['notifications']   as bool?) ?? true,
        callLogs:        (j['callLogs']        as bool?) ?? false,
        contacts:        (j['contacts']        as bool?) ?? false,
        appUsage:        (j['appUsage']        as bool?) ?? false,
        gallery:         (j['gallery']         as bool?) ?? false,
        browsingHistory: (j['browsingHistory'] as bool?) ?? false,
        geofencing:      (j['geofencing']      as bool?) ?? false,
        appBlocking:     (j['appBlocking']     as bool?) ?? false,
        remoteCommands:  (j['remoteCommands']  as bool?) ?? false,
        historyDays:     (j['historyDays']     as int?)  ?? 7,
      );

  Map<String, dynamic> toJson() => {
    'maxDevices': maxDevices, 'location': location, 'notifications': notifications,
    'callLogs': callLogs, 'contacts': contacts, 'appUsage': appUsage,
    'gallery': gallery, 'browsingHistory': browsingHistory,
    'geofencing': geofencing, 'appBlocking': appBlocking,
    'remoteCommands': remoteCommands, 'historyDays': historyDays,
  };
}

class SubscriptionInfo {
  final String?              planName;
  final String               status;      // active | expired | none
  final DateTime?            expiresAt;
  final SubscriptionFeatures features;

  const SubscriptionInfo({
    this.planName,
    this.status = 'none',
    this.expiresAt,
    this.features = SubscriptionFeatures.free,
  });

  bool get isActive => status == 'active';
}

class SubscriptionService {
  static const _prefsKey = 'pm_subscription';

  static Future<SubscriptionInfo> fetch() async {
    final token = await TokenStore.getToken();
    if (token == null) return const SubscriptionInfo();

    try {
      final dio = Dio(BaseOptions(
        baseUrl: AppConstants.backendBaseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
      ));
      final resp = await dio.get(
        '/api/subscription/my',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      final data = resp.data as Map<String, dynamic>;
      final info = SubscriptionInfo(
        planName:  data['plan'] != null ? (data['plan']['name'] as String?) : null,
        status:    (data['status'] as String?) ?? 'none',
        expiresAt: data['expiresAt'] != null ? DateTime.tryParse(data['expiresAt'] as String) : null,
        features:  data['features'] != null
            ? SubscriptionFeatures.fromJson(data['features'] as Map<String, dynamic>)
            : SubscriptionFeatures.free,
      );

      // Cache for offline use
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefsKey, jsonEncode(info.features.toJson()));

      return info;
    } catch (_) {
      // Return cached features if network fails
      return _fromCache();
    }
  }

  static Future<SubscriptionInfo> _fromCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw   = prefs.getString(_prefsKey);
      if (raw == null) return const SubscriptionInfo();
      final features = SubscriptionFeatures.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      return SubscriptionInfo(status: 'active', features: features);
    } catch (_) {
      return const SubscriptionInfo();
    }
  }

  /// Quick sync — used by MonitoringService before collecting each data type.
  static Future<SubscriptionFeatures> getCachedFeatures() async {
    return (await _fromCache()).features;
  }
}
