# Setup Guide

## Prerequisites

| Tool              | Version   | Install                              |
|-------------------|-----------|--------------------------------------|
| Flutter           | ≥ 3.19    | https://flutter.dev/docs/get-started |
| Android Studio    | Hedgehog+ | Bundled Kotlin, Gradle               |
| JDK               | 17        | Android Studio → SDK Tools           |
| Android SDK       | API 34    | Android Studio → SDK Manager         |
| Device / emulator | API 23+   | Physical device recommended          |

---

## 1 — Clone & open

```bash
# The project is already in c:\xampp\htdocs\parental_monitor\
cd parental_monitor/mobile_app
```

Open the `mobile_app/` folder in Android Studio (or VS Code with
Flutter extension).

---

## 2 — Install Flutter dependencies

```bash
cd mobile_app
flutter pub get
```

---

## 3 — Generate code (Drift + json_serializable)

Drift and `json_annotation` require a one-time (and after-model-change)
code-generation step:

```bash
flutter pub run build_runner build --delete-conflicting-outputs
```

This generates:
- `lib/storage/app_database.g.dart`
- `lib/storage/daos/*.g.dart`
- `lib/models/*.g.dart`

---

## 4 — Android local.properties

Create `mobile_app/android/local.properties` (not committed to git):

```properties
sdk.dir=C:\\Users\\<YOU>\\AppData\\Local\\Android\\Sdk
flutter.sdk=C:\\flutter
flutter.versionCode=1
flutter.versionName=1.0.0
```

---

## 5 — Run

```bash
flutter run                    # debug
flutter run --release          # release (no debug banner)
```

---

## 6 — Grant special permissions (physical device)

After first launch, grant these **manually** in Android Settings:

| Permission         | Path                                               |
|--------------------|----------------------------------------------------|
| Notification Access| Settings → Apps → Special App Access → Notification Access → Device Monitor → ON |
| Usage Stats        | Settings → Apps → Special App Access → Usage Access → Device Monitor → ON |
| Background Location| Settings → Apps → Device Monitor → Permissions → Location → Allow all the time |
| Battery exemption  | Settings → Apps → Device Monitor → Battery → Unrestricted |

The app's **Permissions** card guides you to the Notification and
Usage Settings screens automatically.

---

## 7 — Verify tracking service

1. Tap the toggle in the app — it calls `startTrackingService()` which
   starts `TrackingForegroundService`.
2. You should see a persistent "Device Monitor — Running in background"
   notification in the status bar.
3. Pull to refresh the app — GPS, battery, and (if granted) usage data
   should appear.

---

## 8 — Build release APK

```bash
flutter build apk --release
# Output: build/app/outputs/flutter-apk/app-release.apk
```

Sideload to target devices via `adb install` or file transfer.

---

## Future: wiring the backend

When the Node.js backend is ready:

1. Edit `mobile_app/lib/services/sync_service.dart`
2. Change `_baseUrl` to your server's URL
3. Uncomment the `_dio.post(...)` block in `sync()`
4. `SyncService` is already called by WorkManager `pm_sync_task`
   every 15 minutes — no other changes needed.
