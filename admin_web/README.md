# Admin Web Dashboard — Placeholder

**Status: NOT IMPLEMENTED — Scaffold Only**

## Planned Stack

- **Framework**: Next.js 14 (App Router)
- **UI Library**: shadcn/ui + Tailwind CSS
- **Maps**: react-leaflet (OpenStreetMap — free)
- **Charts**: Recharts
- **Realtime**: Socket.IO client
- **State**: Zustand
- **HTTP**: Axios + React Query

## Planned Pages

```
/                    Overview — all devices status
/devices/:id         Single device dashboard
/devices/:id/map     Live GPS map view
/devices/:id/usage   App usage analytics
/devices/:id/logs    Notification + event logs
/settings            Alert thresholds, device management
```

## Planned Directory Structure

```
admin_web/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                     Dashboard overview
│   ├── devices/
│   │   └── [id]/
│   │       ├── page.tsx
│   │       ├── map/page.tsx
│   │       ├── usage/page.tsx
│   │       └── logs/page.tsx
│   └── settings/page.tsx
├── components/
│   ├── map/
│   │   ├── LiveMap.tsx              react-leaflet map
│   │   └── LocationMarker.tsx
│   ├── charts/
│   │   ├── AppUsageChart.tsx        Bar chart — time per app
│   │   └── ActivityTimeline.tsx
│   ├── device/
│   │   ├── DeviceCard.tsx
│   │   ├── BatteryStatus.tsx
│   │   └── ConnectivityBadge.tsx
│   └── logs/
│       └── NotificationFeed.tsx
├── lib/
│   ├── api.ts                       Backend API client
│   ├── socket.ts                    Socket.IO connection
│   └── types.ts                     Shared type definitions
├── store/
│   └── deviceStore.ts               Zustand store
├── package.json
└── next.config.ts
```

## Key UI Components

### Live Map View
- Displays real-time GPS position with trail (last 50 points)
- Geofence circle overlay (configurable radius)
- Alert when device exits geofence

### App Usage Chart
- Daily bar chart: time spent per app
- Color-coded by category (social, games, education)
- Filterable by date range

### Notification Feed
- Chronological list of captured notifications
- Filter by app
- Search by keyword
