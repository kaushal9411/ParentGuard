class ChannelConstants {
  ChannelConstants._();

  // ── MethodChannel names ───────────────────────────────────────────────────
  static const String trackingChannel    = 'com.parentalmonitor/tracking';
  static const String locationChannel    = 'com.parentalmonitor/location';
  static const String usageChannel       = 'com.parentalmonitor/usage';
  static const String deviceChannel      = 'com.parentalmonitor/device';
  static const String monitoringChannel  = 'com.parentalmonitor/monitoring';

  // ── EventChannel names ────────────────────────────────────────────────────
  static const String locationStream     = 'com.parentalmonitor/location_stream';
  static const String notificationStream = 'com.parentalmonitor/notification_stream';

  // ── Tracking methods ──────────────────────────────────────────────────────
  static const String startTracking    = 'startTrackingService';
  static const String stopTracking     = 'stopTrackingService';
  static const String isTrackingActive = 'isTrackingActive';

  // ── Location methods ──────────────────────────────────────────────────────
  static const String getLocation          = 'getLocation';
  static const String startLocationUpdates = 'startLocationUpdates';
  static const String stopLocationUpdates  = 'stopLocationUpdates';

  // ── Usage methods ─────────────────────────────────────────────────────────
  static const String getInstalledApps       = 'getInstalledApps';
  static const String getUsageStats          = 'getUsageStats';
  static const String hasUsagePermission     = 'hasUsagePermission';
  static const String requestUsagePermission = 'requestUsagePermission';

  // ── Device methods ────────────────────────────────────────────────────────
  static const String getBatteryStatus          = 'getBatteryStatus';
  static const String getDeviceInfo             = 'getDeviceInfo';
  static const String getNetworkStatus          = 'getNetworkStatus';
  static const String openNotificationSettings  = 'openNotificationSettings';
  static const String isNotificationAccessGranted = 'isNotificationAccessGranted';
  static const String openBatterySettings           = 'openBatterySettings';
  static const String isBatteryOptimizationExempt  = 'isBatteryOptimizationExempt';
  static const String openAccessibilitySettings    = 'openAccessibilitySettings';
  static const String isAccessibilityGranted       = 'isAccessibilityGranted';

  // ── Monitoring methods ────────────────────────────────────────────────────
  static const String getCallLogs        = 'getCallLogs';
  static const String getContacts        = 'getContacts';
  static const String getGalleryItems    = 'getGalleryItems';
  static const String getBrowsingHistory = 'getBrowsingHistory';
  static const String getNotifications      = 'getNotifications';
  static const String getGalleryImageData   = 'getGalleryImageData';
  static const String getGalleryVideoData   = 'getGalleryVideoData';
  static const String updateBlockedApps  = 'updateBlockedApps';
  static const String getStoredGeofences = 'getStoredGeofences';
}
