import { prisma } from '../config/database';
import { getIO } from '../config/socket';
import { getUserFeatures } from '../routes/subscriptions';
import type { SubscriptionFeatures } from '../types/subscription';

// Map event type → feature key required to store it
const EVENT_FEATURE_MAP: Partial<Record<string, keyof SubscriptionFeatures>> = {
  location:       'location',
  appUsage:       'appUsage',
  notification:   'notifications',
  callLog:        'callLogs',
  smsLog:         'smsLogs',
  contact:        'contacts',
  galleryItem:    'gallery',
  browsingHistory:'browsingHistory',
  // deviceStatus and geofenceAlert are always stored (no plan gate)
};
// broadcastNewData via Soketi removed — Socket.IO handles real-time (same port, no extra server)

export type EventType =
  | 'location'
  | 'appUsage'
  | 'notification'
  | 'deviceStatus'
  | 'callLog'
  | 'smsLog'
  | 'contact'
  | 'galleryItem'
  | 'browsingHistory'
  | 'geofenceAlert';

export interface RawEvent {
  id: string;
  type: EventType;
  payload: Record<string, unknown>;
}

export interface IngestResult {
  processed: number;
  failed: number;
}

export async function ingestEvents(
  deviceId: string,
  userId: string,
  events: RawEvent[],
): Promise<IngestResult> {
  let processed = 0;
  let failed = 0;

  // Fetch user's plan features once for the whole batch
  let features: SubscriptionFeatures;
  try { features = await getUserFeatures(userId); }
  catch { features = (await import('../types/subscription')).FREE_FEATURES; }

  for (const event of events) {
    // Check if this event type is allowed by the user's plan
    const featureKey = EVENT_FEATURE_MAP[event.type];
    if (featureKey) {
      const allowed = features[featureKey];
      if (typeof allowed === 'boolean' && !allowed) {
        // Silently skip events not in plan (don't count as failed)
        continue;
      }
    }

    try {
      await ingestOne(deviceId, event);
      processed++;
    } catch (err) {
      console.error(`[ingest] rejected ${event.type} id=${event.id}:`, err);
      failed++;
    }
  }

  const device = await prisma.device.findFirst({
    where: { deviceId, userId },
    select: { name: true },
  });

  await prisma.device.updateMany({
    where: { deviceId, userId },
    data: { lastSeen: new Date(), isOnline: true },
  });

  // Collect unique event types for the push payload
  const types = [...new Set(events.map((e) => e.type))];

  // 1. Socket.IO — instant if tab is already open and connected
  const payload = {
    deviceId,
    deviceName: device?.name ?? deviceId,
    userId,
    types,
    processed,
    ts: new Date().toISOString(),
  };
  try {
    const io = getIO();
    io.to(`parent:${userId}`).emit('device:events', payload);
    io.to('admin').emit('device:events', payload);        // admin panel room
  } catch {
    // Socket not initialised yet — non-fatal
  }


  return { processed, failed };
}

async function ingestOne(deviceId: string, event: RawEvent): Promise<void> {
  const p = event.payload;

  switch (event.type) {
    case 'location':
      await prisma.locationLog.create({
        data: {
          id: event.id,
          deviceId,
          latitude:     p.latitude     as number,
          longitude:    p.longitude    as number,
          accuracy:     (p.accuracy    as number)  ?? null,
          altitude:     (p.altitude    as number)  ?? null,
          speed:        (p.speed       as number)  ?? null,
          heading:      (p.heading     as number)  ?? null,
          provider:     (p.provider    as string)  ?? null,
          address:      (p.address     as string)  ?? null,
          activityType: (p.activityType as string) ?? null,
          isMoving:     (p.isMoving    as boolean) ?? null,
          capturedAt:   new Date(p.capturedAt as string),
        },
      });
      break;

    case 'appUsage':
      await prisma.appUsageLog.create({
        data: {
          id:              event.id,
          deviceId,
          packageName:     p.packageName     as string,
          appName:         p.appName         as string,
          usageDurationMs: BigInt(p.usageDurationMs as number),
          launchCount:     (p.launchCount    as number) ?? 0,
          // lastUsed is not always sent by the client; fall back to capturedAt
          lastUsed:        new Date((p.lastUsed ?? p.capturedAt) as string),
          capturedAt:      new Date(p.capturedAt as string),
          category:        (p.category as string) ?? null,
        },
      });
      break;

    case 'notification':
      await prisma.notificationLog.create({
        data: {
          id:          event.id,
          deviceId,
          packageName: p.packageName as string,
          appName:     p.appName    as string,
          title:       (p.title   as string) ?? null,
          body:        (p.body    as string) ?? null,
          bigText:     (p.bigText as string) ?? null,
          postedAt:    new Date(p.postedAt as string),
          category:    (p.category as string) ?? null,
          isRead:      (p.isRead   as boolean) ?? false,
        },
      });
      break;

    case 'deviceStatus':
      await prisma.deviceStatusLog.create({
        data: {
          id:             event.id,
          deviceId,
          batteryLevel:   p.batteryLevel   as number,
          isCharging:     p.isCharging     as boolean,
          networkType:    p.networkType    as string,
          isConnected:    p.isConnected    as boolean,
          wifiSsid:       (p.wifiSsid       as string) ?? null,
          signalStrength: (p.signalStrength as number) ?? null,
          capturedAt:     new Date(p.capturedAt as string),
        },
      });
      break;

    case 'callLog':
      await prisma.callLog.upsert({
        where:  { id: event.id },
        update: {},   // immutable once stored — dedup on stable call _ID
        create: {
          id:        event.id,
          deviceId,
          number:    p.number    as string,
          name:      (p.name    as string) ?? null,
          type:      p.type     as string,
          duration:  p.duration as number,
          simSlot:   (p.simSlot as number) ?? null,
          timestamp: new Date(p.timestamp as string),
        },
      });
      break;

    case 'smsLog':
      await prisma.smsLog.upsert({
        where:  { id: event.id },
        update: {},   // immutable once stored
        create: {
          id:       event.id,
          deviceId,
          address:  (p.address  as string) ?? '',
          body:     (p.body     as string) ?? '',
          type:     (p.type     as number) ?? 1,
          date:     new Date(p.date as number),
          isRead:   (p.read     as boolean) ?? false,
          threadId: (p.threadId as string) ?? null,
          subject:  (p.subject  as string) ?? null,
        },
      });
      break;

    case 'contact':
      await prisma.contact.upsert({
        where:  { id: event.id },
        update: {
          name:   p.name   as string,
          phones: JSON.stringify(p.phones ?? []),
          emails: JSON.stringify(p.emails ?? []),
          groups: JSON.stringify(p.groups ?? []),
          notes:  (p.notes as string) ?? null,
        },
        create: {
          id:      event.id,
          deviceId,
          name:    p.name   as string,
          phones:  JSON.stringify(p.phones ?? []),
          emails:  JSON.stringify(p.emails ?? []),
          groups:  JSON.stringify(p.groups ?? []),
          notes:   (p.notes as string) ?? null,
        },
      });
      break;

    case 'galleryItem':
      await prisma.galleryItem.upsert({
        where:  { id: event.id },
        update: {
          thumbnail: (p.thumbnail as string) || null,
        },
        create: {
          id:        event.id,
          deviceId,
          fileName:  p.fileName as string,
          mimeType:  p.mimeType as string,
          sizeBytes: BigInt(p.sizeBytes as number),
          width:     (p.width     as number)  ?? null,
          height:    (p.height    as number)  ?? null,
          duration:  (p.duration  as number)  ?? null,
          takenAt:   p.takenAt ? new Date(p.takenAt as string) : null,
          localPath: (p.localPath as string)  ?? null,
          album:     (p.album     as string)  ?? null,
          thumbnail: (p.thumbnail as string)  || null,
        },
      });
      break;

    case 'browsingHistory': {
      // visitedAt may arrive as an ISO-8601 string OR a raw ms-epoch integer
      const rawVisitedAt = p.visitedAt;
      const visitedAt = typeof rawVisitedAt === 'number'
        ? new Date(rawVisitedAt)
        : new Date(rawVisitedAt as string);

      if (isNaN(visitedAt.getTime())) {
        throw new Error(`Invalid visitedAt value: ${rawVisitedAt}`);
      }

      await prisma.browsingHistory.create({
        data: {
          id:         event.id,
          deviceId,
          url:        p.url        as string,
          title:      (p.title     as string) ?? null,
          visitedAt,
          browserApp: (p.browserApp as string) ?? null,
          visitCount: (p.visitCount as number) ?? 1,
        },
      });
      break;
    }

    case 'geofenceAlert':
      await prisma.geofenceAlert.create({
        data: {
          id:          event.id,
          geofenceId:  p.geofenceId  as string,
          deviceId,
          alertType:   p.alertType   as string,
          latitude:    p.latitude    as number,
          longitude:   p.longitude   as number,
          triggeredAt: new Date(p.triggeredAt as string),
        },
      });
      break;

    default:
      throw new Error(`Unknown event type: ${(event as RawEvent).type}`);
  }
}
