import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { requireFeature } from '../middleware/feature';

const router = Router();

// GET /api/notifications/:deviceId?limit=50&before=<ISO>
router.get('/:deviceId', authenticate, requireFeature('notifications'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const before = req.query.before ? new Date(req.query.before as string) : undefined;

  const device = await prisma.device.findFirst({
    where: { deviceId: req.params.deviceId as string, userId: req.auth.userId },
  });
  if (!device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  const logs = await prisma.notificationLog.findMany({
    where: {
      deviceId: req.params.deviceId as string,
      ...(before ? { postedAt: { lt: before } } : {}),
    },
    orderBy: { postedAt: 'desc' },
    take: limit,
  });

  res.json(logs);
});

export default router;
