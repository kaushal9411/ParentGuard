import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/location/:deviceId?limit=50&before=<ISO>
router.get('/:deviceId', authenticate, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const before = req.query.before ? new Date(req.query.before as string) : undefined;

  const device = await prisma.device.findFirst({
    where: { deviceId: req.params.deviceId, userId: req.auth.userId },
  });
  if (!device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  const logs = await prisma.locationLog.findMany({
    where: {
      deviceId: req.params.deviceId,
      ...(before ? { capturedAt: { lt: before } } : {}),
    },
    orderBy: { capturedAt: 'desc' },
    take: limit,
  });

  res.json(logs);
});

export default router;
