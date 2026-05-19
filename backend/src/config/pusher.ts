import Pusher from 'pusher';

// Connects to a local Soketi server (Pusher-compatible).
// Soketi must be running: npx @soketi/soketi start --config=../../soketi.json
// Configure via env vars — defaults match soketi.json
const pusher = new Pusher({
  appId:   process.env.SOKETI_APP_ID     ?? 'parentguard',
  key:     process.env.SOKETI_APP_KEY    ?? 'parentguard-key',
  secret:  process.env.SOKETI_APP_SECRET ?? 'parentguard-secret',
  host:    process.env.SOKETI_HOST       ?? '127.0.0.1',
  port:    process.env.SOKETI_PORT       ?? '6001',
  useTLS:  false,
  cluster: 'mt1', // required by pusher client but ignored by Soketi
});

/**
 * Broadcast that new device data arrived.
 * Admin web listens on the `pm-live` channel and auto-refreshes when triggered.
 *
 * @param userId   The parent/owner user ID (used by admin to filter updates)
 * @param deviceId Which device sent the data
 * @param types    Which event types were ingested (location, notification, etc.)
 */
export async function broadcastNewData(
  userId: string,
  deviceId: string,
  types: string[],
  deviceName?: string,
): Promise<void> {
  try {
    await pusher.trigger('pm-live', 'device.data', {
      userId,
      deviceId,
      deviceName: deviceName ?? deviceId,
      types,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    // Soketi not running — non-fatal, FCM still works as fallback
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Soketi] push failed (is Soketi running?):', (err as Error).message);
    }
  }
}
