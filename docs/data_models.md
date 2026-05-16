# Data Models

All models live in `mobile_app/lib/models/`. JSON serialisation is
handled by `json_serializable` (run `flutter pub run build_runner build`
to regenerate `.g.dart` files). Drift table schemas mirror these models
exactly — see `mobile_app/lib/storage/tables/`.

---

## LocationModel

Captures one GPS fix.

| Field        | Type     | Notes                                |
|--------------|----------|--------------------------------------|
| `id`         | String   | UUID v4                              |
| `deviceId`   | String   | From `DeviceIdUtil.get()` (Android ID) |
| `latitude`   | double   |                                      |
| `longitude`  | double   |                                      |
| `accuracy`   | double   | Radius in metres                     |
| `altitude`   | double   | Metres above sea level               |
| `speed`      | double   | m/s                                  |
| `heading`    | double   | Bearing 0–360°                       |
| `provider`   | String   | "fused" / "gps" / "network"          |
| `capturedAt` | DateTime |                                      |
| `synced`     | bool     | false until backend ACK              |
| `address`    | String?  | Reverse-geocoded (future)            |

---

## AppUsageModel

One row per app per capture window.

| Field              | Type     | Notes                              |
|--------------------|----------|------------------------------------|
| `id`               | String   | UUID v4                            |
| `deviceId`         | String   |                                    |
| `packageName`      | String   | e.g. `com.instagram.android`       |
| `appName`          | String   | Human-readable label               |
| `usageDurationMs`  | int      | Total foreground time in the window |
| `lastUsed`         | DateTime | Last `lastTimeUsed` from UsageStats |
| `capturedAt`       | DateTime | When the snapshot was taken        |
| `synced`           | bool     |                                    |
| `category`         | String?  | Future: COMMUNICATION, SOCIAL, etc. |

Computed: `usageDurationMinutes = usageDurationMs ~/ 60000`

---

## NotificationModel

One row per notification received.

| Field         | Type                    | Notes                        |
|---------------|-------------------------|------------------------------|
| `id`          | String                  | UUID v4 (or `sbn.key`)       |
| `deviceId`    | String                  |                              |
| `packageName` | String                  |                              |
| `appName`     | String                  |                              |
| `title`       | String                  |                              |
| `body`        | String                  |                              |
| `postedAt`    | DateTime                | `sbn.postTime`               |
| `synced`      | bool                    |                              |
| `category`    | String?                 | Future                       |
| `extras`      | `Map<String,dynamic>?`  | Raw notification extras      |

---

## DeviceStatusModel

Periodic battery + connectivity snapshot.

| Field           | Type     | Notes                              |
|-----------------|----------|------------------------------------|
| `id`            | String   | UUID v4                            |
| `deviceId`      | String   |                                    |
| `batteryLevel`  | int      | 0–100 %                            |
| `isCharging`    | bool     |                                    |
| `networkType`   | String   | "wifi" / "mobile" / "ethernet" / "none" |
| `isConnected`   | bool     |                                    |
| `capturedAt`    | DateTime |                                    |
| `synced`        | bool     |                                    |
| `wifiSsid`      | String?  | Future: requires additional permission |
| `signalStrength`| int?     | dBm (negative), WiFi only          |

---

## EventQueueModel

Outbound sync queue entry.

| Field           | Type              | Notes                                |
|-----------------|-------------------|--------------------------------------|
| `id`            | String            | UUID v4                              |
| `eventType`     | `EventType` enum  | location / appUsage / notification / deviceStatus |
| `payload`       | `Map<String,dynamic>` | Serialised model                 |
| `createdAt`     | DateTime          |                                      |
| `status`        | `EventStatus` enum| pending / inProgress / failed / deadLetter / completed |
| `retryCount`    | int               | Incremented on each failed attempt   |
| `lastAttemptAt` | DateTime?         |                                      |
| `errorMessage`  | String?           | Last error for debugging             |

Status transitions:
```
pending → inProgress → completed
                    ↘ failed (retryCount < 3) → pending (after requeueFailed)
                    ↘ deadLetter (retryCount ≥ 3)
```

---

## Local DB Schema (Drift / SQLite)

```sql
CREATE TABLE location_entries (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy REAL NOT NULL,
  altitude REAL NOT NULL,
  speed REAL NOT NULL,
  heading REAL NOT NULL,
  provider TEXT NOT NULL,
  captured_at INTEGER NOT NULL,  -- Unix ms stored by Drift
  synced INTEGER NOT NULL DEFAULT 0,
  address TEXT
);

CREATE TABLE app_usage_entries (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  package_name TEXT NOT NULL,
  app_name TEXT NOT NULL,
  usage_duration_ms INTEGER NOT NULL,
  last_used INTEGER NOT NULL,
  captured_at INTEGER NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0,
  category TEXT
);

CREATE TABLE notification_entries (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  package_name TEXT NOT NULL,
  app_name TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  posted_at INTEGER NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  extras_json TEXT
);

CREATE TABLE device_status_entries (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  battery_level INTEGER NOT NULL,
  is_charging INTEGER NOT NULL,
  network_type TEXT NOT NULL,
  is_connected INTEGER NOT NULL,
  captured_at INTEGER NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0,
  wifi_ssid TEXT,
  signal_strength INTEGER
);

CREATE TABLE event_queue_entries (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at INTEGER,
  error_message TEXT
);
```
