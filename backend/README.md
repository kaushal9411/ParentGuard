# Backend — Placeholder

**Status: NOT IMPLEMENTED — Scaffold Only**

## Planned Stack

- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js
- **Realtime**: Socket.IO
- **Database**: PostgreSQL 16
- **ORM**: Prisma
- **Auth**: JWT
- **Queue**: Bull (Redis-backed)

## Planned API Endpoints

```
POST   /api/devices/register          Register a child device
GET    /api/devices/:id/status        Get device status

POST   /api/events/batch              Batch ingest events (location, usage, etc.)

GET    /api/location/:deviceId        Get location history
GET    /api/usage/:deviceId           Get app usage for a device
GET    /api/notifications/:deviceId   Get captured notifications

GET    /api/devices                   List all registered devices (admin)
```

## Planned WebSocket Events (Socket.IO)

```
device:location      → realtime GPS push from device
device:status        → battery/connectivity updates
device:alert         → threshold-based alerts (geofence, app limit)
```

## Planned Database Schema

```sql
-- Devices
CREATE TABLE devices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  device_id   TEXT UNIQUE NOT NULL,
  registered_at TIMESTAMPTZ DEFAULT NOW()
);

-- Location logs
CREATE TABLE location_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   UUID REFERENCES devices(id),
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  accuracy    REAL,
  altitude    REAL,
  speed       REAL,
  bearing     REAL,
  captured_at TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- App usage logs
CREATE TABLE app_usage_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id     UUID REFERENCES devices(id),
  package_name  TEXT NOT NULL,
  app_name      TEXT,
  total_time_ms BIGINT NOT NULL,
  last_used_at  TIMESTAMPTZ,
  usage_date    DATE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Notification logs
CREATE TABLE notification_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id    UUID REFERENCES devices(id),
  package_name TEXT,
  app_name     TEXT,
  title        TEXT,
  body         TEXT,
  captured_at  TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Device status logs
CREATE TABLE device_status_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id     UUID REFERENCES devices(id),
  battery_level INT,
  is_charging   BOOLEAN,
  network_type  TEXT,
  captured_at   TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

## Planned Directory Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts
│   │   └── socket.ts
│   ├── routes/
│   │   ├── devices.ts
│   │   ├── events.ts
│   │   ├── location.ts
│   │   └── usage.ts
│   ├── services/
│   │   ├── eventIngestion.ts
│   │   └── realtimeEmitter.ts
│   ├── middleware/
│   │   └── auth.ts
│   └── index.ts
├── prisma/
│   └── schema.prisma
├── package.json
└── tsconfig.json
```
