# System Architecture

## Overview

```
┌─────────────────────────────────────────────────────────┐
│                   CHILD DEVICE (Android)                 │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Flutter UI Layer (Dart)              │   │
│  │  DashboardPage → Riverpod Providers → Services   │   │
│  └──────────────┬───────────────────────────────────┘   │
│                 │ MethodChannel                          │
│  ┌──────────────▼───────────────────────────────────┐   │
│  │          Kotlin Native Layer (Android)            │   │
│  │                                                   │   │
│  │  PlatformChannelHandler                          │   │
│  │       ↓              ↓              ↓            │   │
│  │  LocationSvc   UsageTracker   LocalDataStore     │   │
│  │       ↓              ↓                           │   │
│  │  ForegroundService (START_STICKY)                │   │
│  │       ↓                                          │   │
│  │  BootReceiver (auto-restart)                     │   │
│  │  NotificationListenerService (system-bound)      │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │          sqflite Local Database (SQLite)          │   │
│  │  location_logs | app_usage_logs | notifications  │   │
│  │  device_status_logs | event_queue                │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                          │ HTTP batch (future)
                          ▼
              ┌─────────────────────┐
              │   Node.js Backend   │
              │   PostgreSQL DB     │
              │   Socket.IO         │
              └─────────┬───────────┘
                        │ WebSocket
                        ▼
              ┌─────────────────────┐
              │   Next.js Admin     │
              │   Dashboard         │
              └─────────────────────┘
```

## Data Flow

### Location Tracking
```
FusedLocationProvider (Kotlin)
  → onLocationResult callback (every 30s)
  → LocalDataStore.saveLocation() (SharedPrefs queue)
  → [Flutter polls via platform channel every 60s]
  → DatabaseHelper.insertLocation() (sqflite)
  → EventQueue.enqueue() (pending sync)
  → [SyncEngine batch upload — future]
```

### App Usage Tracking
```
UsageStatsManager (Kotlin)
  → queried every 5 minutes by AppUsageTrackerService
  → LocalDataStore.saveUsageStats() (SharedPrefs)
  → [Flutter polls via platform channel]
  → DatabaseHelper.upsertUsage() (sqflite)
```

### Notification Capture
```
NotificationListenerService (system-bound)
  → onNotificationPosted()
  → LocalDataStore.saveNotification() (SharedPrefs)
  → [Flutter polls via platform channel]
  → DatabaseHelper.insertNotification() (sqflite)
```

## Offline-First Design

All data is written to local SQLite first. The `event_queue` table
holds all unsynced events. When backend is implemented:

1. `SyncEngine` reads batches of up to 50 events from `event_queue`
2. POST to `/api/events/batch`
3. On success: mark events as `synced`
4. On failure: increment `retry_count`, retry up to 3 times
5. Events older than 7 days and synced are pruned

## Service Restart Chain

```
Device Boot
  → BootReceiver.onReceive(BOOT_COMPLETED)
  → TrackingForegroundService.startService()
  → Foreground notification shown (cannot be killed)
  → LocationService.startLocationUpdates()
  → AppUsageTrackerService.startTracking()

App Killed by System
  → ForegroundService.onTaskRemoved()
  → AlarmManager schedules restart in 1 second
  → Service restarts with START_STICKY
```

## Platform Channel Interface

```
Flutter (Dart)                    Kotlin (Android)
─────────────────────────────────────────────────
startTrackingService()      →    TrackingForegroundService.startService()
stopTrackingService()       →    TrackingForegroundService.stopService()
getLocation()               →    LocationService.getLastLocation()
getUsageStats(startTime)    →    AppUsageTrackerService.getUsageStats()
getInstalledApps()          →    AppUsageTrackerService.getInstalledAppsWithUsage()
getPendingLocationQueue()   →    LocalDataStore.getAndClearLocationQueue()
getPendingNotificationQueue() →  LocalDataStore.getAndClearNotificationQueue()
isNotificationAccessGranted() →  MonitorNotificationListenerService.isGranted()
openNotificationSettings()  →    Intent to system settings
```

## State Management (Riverpod)

```
TrackingService (singleton)
  ├── locationProvider (StateNotifierProvider)
  │     └── List<LocationModel> — last 100 locations from DB
  ├── usageProvider (StateNotifierProvider)
  │     └── List<AppUsageModel> — today's usage
  └── deviceStatusProvider (StateNotifierProvider)
        └── DeviceStatusModel — battery + connectivity
```
