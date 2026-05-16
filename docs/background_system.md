# Background System Design

## Overview

Three independent mechanisms keep the tracking alive across OEM
battery-killers, task-killer apps, and OS-initiated process death.

```
┌─────────────────────────────────────────────────────────────────┐
│  MECHANISM 1 — ForegroundService (real-time, while alive)       │
│    TrackingForegroundService                                     │
│    • Runs with a persistent foreground notification              │
│    • Kotlin coroutine loops every 5 min                          │
│    • Captures: GPS fix + device status                           │
│    • START_STICKY = Android auto-restarts after OOM kill         │
│    • onTaskRemoved → AlarmManager restart in 1 second           │
└─────────────────────────────────────────────────────────────────┘
         │ survives process death?  not always on aggressive OEMs
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  MECHANISM 2 — WorkManager (guaranteed deferred execution)      │
│    Registered once in AppEntryPoint._bootstrap()                 │
│    • pm_location_task  : every 15 min (periodic)                 │
│    • pm_sync_task      : every 15 min, needs network             │
│    • pm_usage_task     : every 10 min                            │
│    WorkManager respects Doze / battery-save and retries          │
│    automatically — the OS decides the exact timing.              │
└─────────────────────────────────────────────────────────────────┘
         │ survives reboot?  NO
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  MECHANISM 3 — BootReceiver (restart after reboot / update)     │
│    Triggers on: BOOT_COMPLETED, QUICKBOOT_POWERON,              │
│                 MY_PACKAGE_REPLACED                              │
│    → starts TrackingForegroundService                            │
│    → WorkManager periodic tasks survive reboot automatically     │
└─────────────────────────────────────────────────────────────────┘
```

## Event Batching

```
GPS / Usage / Notification
        │
        ▼ insert
  SQLite (Drift local DB)
        │
        ▼ EventQueueService.enqueue()
  event_queue_entries
  ┌──────────────────────────────────────────┐
  │ id | event_type | payload_json | status   │
  │    | retryCount | lastAttemptAt | error   │
  └──────────────────────────────────────────┘
        │
        ▼ SyncService.sync() (called by WorkManager pm_sync_task)
  Batch read (50 events)
        │
        ├─ success → mark 'completed' → delete on next cleanup()
        └─ failure → increment retryCount
                   → 'failed' if retries remain
                   → 'deadLetter' if retries exhausted
```

## Battery Optimisation Strategy

| Strategy                       | How implemented                              |
|--------------------------------|----------------------------------------------|
| Foreground notification        | `startForeground()` in TrackingForegroundService |
| Request battery exemption      | `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`       |
| WorkManager constraints        | `NetworkType.connected` for sync task only   |
| Graceful degradation           | Services catch all exceptions; never crash   |
| Coarse location fallback       | `ACCESS_COARSE_LOCATION` as GPS backup       |
| Adaptive interval              | 5-min service loop; 15-min WorkManager gap   |

## OEM-Specific Notes

Many aggressive OEM ROMs (Xiaomi MIUI, Huawei EMUI, Samsung One UI) kill
background services even with the above. Additional steps for production:

1. **Whitelist in OEM battery settings** — direct user via `openBatterySettings()`
   platform channel call on first launch.
2. **Auto-start permission** — some OEMs (Xiaomi) have a separate "Autostart"
   toggle; guide users to it via a settings deep-link Intent.
3. **Sticky start** — `START_STICKY` + `onTaskRemoved` AlarmManager restart
   covers most cases.

## WorkManager vs AlarmManager

WorkManager is preferred because:
- Battery-aware (respects Doze windows)
- Survives app updates (re-registers automatically)
- Handles retry/backoff natively

AlarmManager is used **only** as a 1-second emergency restart in
`onTaskRemoved` — not for scheduling periodic work.
