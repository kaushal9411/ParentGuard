import { prisma } from '../config/database';
import { getIO } from '../config/socket';

export type EventType = 'location' | 'appUsage' | 'notification' | 'deviceStatus';

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

  for (const event of events) {
    try {
      await ingestOne(deviceId, event);
      processed++;
    } catch {
      failed++;
    }
  }

  await prisma.device.updateMany({
    where: { deviceId, userId },
    data: { lastSeen: new Date(), isOnline: true },
  });

  // Notify parent dashboard in real-time
  try {
    getIO().to(`parent:${userId}`).emit('device:events', {
      deviceId,
      processed,
      ts: new Date().toISOString(),
    });
  } catch {
    // Socket not initialized yet — non-fatal during startup
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
          latitude: p.latitude as number,
          longitude: p.longitude as number,
          accuracy: (p.accuracy as number) ?? null,
          altitude: (p.altitude as number) ?? null,
          speed: (p.speed as number) ?? null,
          heading: (p.heading as number) ?? null,
          provider: (p.provider as string) ?? null,
          address: (p.address as string) ?? null,
          capturedAt: new Date(p.capturedAt as string),
        },
      });
      break;

    case 'appUsage':
      await prisma.appUsageLog.create({
        data: {
          id: event.id,
          deviceId,
          packageName: p.packageName as string,
          appName: p.appName as string,
          usageDurationMs: BigInt(p.usageDurationMs as number),
          lastUsed: new Date(p.lastUsed as string),
          capturedAt: new Date(p.capturedAt as string),
          category: (p.category as string) ?? null,
        },
      });
      break;

    case 'notification':
      await prisma.notificationLog.create({
        data: {
          id: event.id,
          deviceId,
          packageName: p.packageName as string,
          appName: p.appName as string,
          title: (p.title as string) ?? null,
          body: (p.body as string) ?? null,
          postedAt: new Date(p.postedAt as string),
          category: (p.category as string) ?? null,
        },
      });
      break;

    case 'deviceStatus':
      await prisma.deviceStatusLog.create({
        data: {
          id: event.id,
          deviceId,
          batteryLevel: p.batteryLevel as number,
          isCharging: p.isCharging as boolean,
          networkType: p.networkType as string,
          isConnected: p.isConnected as boolean,
          wifiSsid: (p.wifiSsid as string) ?? null,
          signalStrength: (p.signalStrength as number) ?? null,
          capturedAt: new Date(p.capturedAt as string),
        },
      });
      break;

    default:
      throw new Error(`Unknown event type: ${(event as RawEvent).type}`);
  }
}
