# Android Permissions Guide

## Full Permissions List (AndroidManifest.xml)

### Location
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
```
| Permission | Required | Reason |
|---|---|---|
| `ACCESS_FINE_LOCATION` | YES | GPS accuracy for tracking |
| `ACCESS_COARSE_LOCATION` | YES | Network-based fallback location |
| `ACCESS_BACKGROUND_LOCATION` | YES | GPS when app is not in foreground |

**User prompt**: Must request foreground location first, then background location separately.
Android 11+ shows "Allow all the time" option.

---

### Foreground Service
```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION"/>
```
| Permission | Required | Reason |
|---|---|---|
| `FOREGROUND_SERVICE` | YES | Run persistent service with notification |
| `FOREGROUND_SERVICE_LOCATION` | YES (API 34+) | Declare foreground service type for location |

---

### App Usage Stats
```xml
<uses-permission android:name="android.permission.PACKAGE_USAGE_STATS"
    tools:ignore="ProtectedPermissions"/>
```
| Permission | Required | Reason |
|---|---|---|
| `PACKAGE_USAGE_STATS` | YES | Query app usage via UsageStatsManager |

**Note**: This is a protected/signature permission. Users must manually grant it via:
Settings → Apps → Special App Access → Usage Access

---

### Notification Access
No `<uses-permission>` needed. Service is declared in manifest.
User must enable via: Settings → Apps → Special App Access → Notification Access

---

### Boot Receiver
```xml
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
```
| Permission | Required | Reason |
|---|---|---|
| `RECEIVE_BOOT_COMPLETED` | YES | Auto-start service after device reboot |

---

### Wake Lock
```xml
<uses-permission android:name="android.permission.WAKE_LOCK"/>
```
| Permission | Required | Reason |
|---|---|---|
| `WAKE_LOCK` | YES | Keep CPU awake in background for location updates |

---

### Battery Optimization
```xml
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS"/>
```
| Permission | Required | Reason |
|---|---|---|
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | Recommended | Prevent system from killing tracking service on low-end devices |

**User prompt**: Directs user to battery optimization settings for the app.

---

### Network
```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE"/>
```
| Permission | Required | Reason |
|---|---|---|
| `INTERNET` | YES | Future: sync data to backend |
| `ACCESS_NETWORK_STATE` | YES | Check connectivity before sync attempt |
| `ACCESS_WIFI_STATE` | Optional | Prefer sync on WiFi |

---

### Accessibility (Optional)
```xml
<uses-permission android:name="android.permission.BIND_ACCESSIBILITY_SERVICE"/>
```
Only needed if `MonitorAccessibilityService` is enabled.
User grants via: Settings → Accessibility → Parental Monitor

---

## Permission Request Flow (Flutter)

```dart
// 1. Request location (foreground first)
await Permission.locationWhenInUse.request();

// 2. Then background location
await Permission.locationAlways.request();

// 3. Battery optimization exemption
if (Platform.isAndroid) {
  final androidInfo = await DeviceInfoPlugin().androidInfo;
  if (androidInfo.version.sdkInt >= 23) {
    await Permission.ignoreBatteryOptimizations.request();
  }
}

// 4. Notification access — redirect to settings
// (cannot be requested programmatically)
await channel.invokeMethod('openNotificationSettings');

// 5. Usage stats access — redirect to settings
// (cannot be requested programmatically)  
```

## Runtime Permission Behavior by Android Version

| Android Version | Background Location | Notes |
|---|---|---|
| < 10 (API 28) | Granted with foreground | Single permission dialog |
| 10 (API 29) | Separate dialog | "Allow all the time" in dialog |
| 11+ (API 30+) | Must go to Settings | "Allow all the time" removed from dialog |
| 12+ (API 31+) | Same as 11+ | `BLUETOOTH_SCAN` added if using BLE |
| 14 (API 34+) | Same | `FOREGROUND_SERVICE_LOCATION` required |
