import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { ingestEvents, RawEvent } from '../services/eventIngestion';

const router = Router();

const BatchSchema = z.object({
  deviceId: z.string().min(1),
  events: z
    .array(
      z.object({
        id: z.string().min(1),
        type: z.enum([
          'location', 'appUsage', 'notification', 'deviceStatus',
          'callLog', 'contact', 'galleryItem', 'browsingHistory', 'geofenceAlert',
        ]),
        payload: z.record(z.unknown()),
      }),
    )
    .min(1)
    .max(500),
});

// POST /api/events/batch — child device uploads queued events
router.post('/batch', authenticate, async (req, res) => {
  const parsed = BatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { deviceId, events } = parsed.data;
  const result = await ingestEvents(deviceId, req.auth.userId, events as RawEvent[]);
  res.json(result);
});

export default router;
