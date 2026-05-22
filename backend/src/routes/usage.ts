import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { requireFeature } from '../middleware/feature';

const router = Router();

// GET /api/usage/:deviceId?date=YYYY-MM-DD (defaults to last 7 days)
router.get('/:deviceId', authenticate, requireFeature('appUsage'), async (req, res) => {
  const device = await prisma.device.findFirst({
    where: { deviceId: req.params.deviceId as string, userId: req.auth.userId },
  });
  if (!device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  let start: Date, end: Date;
  const dateStr = req.query.date as string | undefined;
  if (dateStr) {
    start = new Date(dateStr);
    end = new Date(dateStr);
    end.setDate(end.getDate() + 1);
  } else {
    end = new Date();
    start = new Date();
    start.setDate(start.getDate() - 7);
  }

  const logs = await prisma.appUsageLog.findMany({
    where: {
      deviceId: req.params.deviceId as string,
      capturedAt: { gte: start, lt: end },
    },
    orderBy: { usageDurationMs: 'desc' },
    take: 100,
  });

  // BigInt is not JSON-serializable — convert to string
  res.json(logs.map(l => ({ ...l, usageDurationMs: l.usageDurationMs.toString() })));
});

export default router;
