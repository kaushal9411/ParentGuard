import * as admin from 'firebase-admin';
import path from 'path';
import { prisma } from './database';

const serviceAccount = require(path.join(__dirname, '../../firebase-service-account.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const messaging = admin.messaging();

export async function sendNewDataPush(userId: string, deviceId: string): Promise<void> {
  try {
    const [tokens, device] = await Promise.all([
      prisma.fcmToken.findMany({ where: { userId }, select: { id: true, token: true } }),
      prisma.device.findFirst({ where: { deviceId }, select: { name: true } }),
    ]);

    if (tokens.length === 0) return;

    const deviceName = device?.name ?? 'device';
    const response = await messaging.sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      notification: {
        title: 'ParentGuard',
        body:  `New activity from ${deviceName}`,
      },
      webpush: {
        notification: { icon: '/icon.png', requireInteraction: false },
        fcmOptions:   { link: '/' },
      },
      data: { type: 'new_data', userId, deviceId, deviceName },
    });

    // Remove tokens that Firebase reported as invalid
    const invalidIds: string[] = [];
    response.responses.forEach((r, i) => {
      if (!r.success && (
        r.error?.code === 'messaging/registration-token-not-registered' ||
        r.error?.code === 'messaging/invalid-registration-token'
      )) {
        invalidIds.push(tokens[i].id);
      }
    });
    if (invalidIds.length > 0) {
      await prisma.fcmToken.deleteMany({ where: { id: { in: invalidIds } } });
    }
  } catch (err) {
    console.warn('[FCM] sendNewDataPush error:', (err as Error).message);
  }
}
