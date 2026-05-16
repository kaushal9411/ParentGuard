# Parental Monitor — MVP

A production-grade Android parental monitoring system built with Flutter + Kotlin native services.

## Monorepo Structure

```
parental_monitor/
├── mobile_app/        Flutter app + Kotlin native services (PRIMARY)
├── android_native/    Kotlin library module reference (future extraction)
├── backend/           Node.js API — placeholder, not implemented
├── admin_web/         Next.js dashboard — placeholder, not implemented
└── docs/              Architecture, permissions, setup guides
```

## Quick Start

See [docs/setup.md](docs/setup.md) for full setup instructions.

```bash
cd mobile_app
flutter pub get
flutter run
```

## Architecture Overview

See [docs/architecture.md](docs/architecture.md) for detailed system design.

## Tech Stack

| Layer          | Tech                          |
|----------------|-------------------------------|
| UI             | Flutter + Riverpod            |
| Native Android | Kotlin (Services, Receivers)  |
| Local DB       | sqflite (SQLite)              |
| Bridge         | Flutter MethodChannel         |
| Future Backend | Node.js + Socket.IO + Postgres|
| Future Web     | Next.js                       |

## Tracking Features

- GPS (foreground + background via FusedLocationProvider)
- App usage stats (UsageStatsManager)
- Notification capture (NotificationListenerService)
- Device status (battery, connectivity)
- Persistent ForegroundService
- Boot auto-restart (BootReceiver)
- Offline-first local storage
- Sync-ready event queue
