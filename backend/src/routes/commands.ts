import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';

const router = Router();

// ── GET /api/commands/pending?deviceId=xxx ────────────────────────────────────
// Device polls for commands it should execute
router.get('/pending', authenticate, async (req, res) => {
  const deviceId = req.query.deviceId as string;
  if (!deviceId) { res.status(400).json({ error: 'deviceId required' }); return; }

  const device = await prisma.device.findFirst({
    where: { deviceId, userId: req.auth.userId },
  });
  if (!device) { res.status(403).json({ error: 'Forbidden' }); return; }

  const commands = await prisma.remoteCommand.findMany({
    where: { deviceId, status: 'pending' },
    orderBy: { issuedAt: 'asc' },
  });

  // Mark as delivered
  if (commands.length > 0) {
    await prisma.remoteCommand.updateMany({
      where: { id: { in: commands.map((c) => c.id) }, status: 'pending' },
      data:  { status: 'delivered', deliveredAt: new Date() },
    });
  }

  res.json(commands);
});

// ── PATCH /api/commands/:commandId/status ─────────────────────────────────────
// Device reports execution result
const UpdateSchema = z.object({
  status: z.enum(['executing', 'completed', 'failed']),
  result: z.string().optional(), // JSON string
});

router.patch('/:commandId/status', authenticate, async (req, res) => {
  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const cmd = await prisma.remoteCommand.findUnique({ where: { id: req.params.commandId as string } });
  if (!cmd) { res.status(404).json({ error: 'Command not found' }); return; }

  // Verify the device belongs to the authenticated user
  const device = await prisma.device.findFirst({
    where: { deviceId: cmd.deviceId, userId: req.auth.userId },
  });
  if (!device) { res.status(403).json({ error: 'Forbidden' }); return; }

  const { status, result } = parsed.data;
  await prisma.remoteCommand.update({
    where: { id: cmd.id },
    data: {
      status,
      result:      result ?? null,
      completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined,
    },
  });

  res.json({ ok: true });
});

// ── GET /api/commands/geofences?deviceId=xxx ──────────────────────────────────
// Device fetches its active geofences
router.get('/geofences', authenticate, async (req, res) => {
  const deviceId = req.query.deviceId as string;
  if (!deviceId) { res.status(400).json({ error: 'deviceId required' }); return; }

  const device = await prisma.device.findFirst({
    where: { deviceId, userId: req.auth.userId },
  });
  if (!device) { res.status(403).json({ error: 'Forbidden' }); return; }

  const geofences = await prisma.geofence.findMany({
    where: { deviceId, isActive: true },
  });
  res.json(geofences);
});

// ── GET /api/commands/app-blocks?deviceId=xxx ─────────────────────────────────
// Device fetches its blocked apps list
router.get('/app-blocks', authenticate, async (req, res) => {
  const deviceId = req.query.deviceId as string;
  if (!deviceId) { res.status(400).json({ error: 'deviceId required' }); return; }

  const device = await prisma.device.findFirst({
    where: { deviceId, userId: req.auth.userId },
  });
  if (!device) { res.status(403).json({ error: 'Forbidden' }); return; }

  const rules = await prisma.appBlockRule.findMany({
    where: { deviceId, isBlocked: true },
  });
  res.json(rules);
});

export default router;
