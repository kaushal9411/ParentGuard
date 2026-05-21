import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';

const router = Router();

// Helper: verify device belongs to the authenticated user
async function ownDevice(deviceId: string, userId: string) {
  return prisma.device.findFirst({ where: { deviceId, userId } });
}

// Helper: verify device belongs to user by internal DB id
async function ownDeviceById(id: string, userId: string) {
  return prisma.device.findFirst({ where: { id, userId } });
}

// ── Gallery ────────────────────────────────────────────────────────────────────

// GET /api/user/gallery?deviceId=xxx&type=image|video
router.get('/gallery', authenticate, async (req, res) => {
  const deviceId = req.query.deviceId as string;
  if (!deviceId) { res.status(400).json({ error: 'deviceId required' }); return; }

  const device = await ownDevice(deviceId, req.auth.userId);
  if (!device) { res.status(403).json({ error: 'Forbidden' }); return; }

  const type = req.query.type as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 200, 500);

  const items = await prisma.galleryItem.findMany({
    where: { deviceId, ...(type ? { mimeType: { startsWith: type } } : {}) },
    orderBy: { takenAt: 'desc' },
    take: limit,
  });
  res.json(items.map((g) => ({ ...g, sizeBytes: g.sizeBytes.toString() })));
});

// ── SMS ───────────────────────────────────────────────────────────────────────

// GET /api/user/sms?deviceId=xxx&limit=200
router.get('/sms', authenticate, async (req, res) => {
  const deviceId = req.query.deviceId as string;
  if (!deviceId) { res.status(400).json({ error: 'deviceId required' }); return; }

  const device = await ownDevice(deviceId, req.auth.userId);
  if (!device) { res.status(403).json({ error: 'Forbidden' }); return; }

  const limit  = Math.min(Number(req.query.limit) || 200, 1000);
  const search = req.query.search as string | undefined;

  const messages = await prisma.smsLog.findMany({
    where: {
      deviceId,
      ...(search ? {
        OR: [
          { address: { contains: search, mode: 'insensitive' } },
          { body:    { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    },
    orderBy: { date: 'desc' },
    take:    limit,
  });
  res.json(messages);
});

// ── Browsing History ───────────────────────────────────────────────────────────

// GET /api/user/browsing?deviceId=xxx&limit=100
router.get('/browsing', authenticate, async (req, res) => {
  const deviceId = req.query.deviceId as string;
  if (!deviceId) { res.status(400).json({ error: 'deviceId required' }); return; }

  const device = await ownDevice(deviceId, req.auth.userId);
  if (!device) { res.status(403).json({ error: 'Forbidden' }); return; }

  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const search = req.query.search as string | undefined;

  const history = await prisma.browsingHistory.findMany({
    where: {
      deviceId,
      ...(search ? {
        OR: [
          { url:        { contains: search, mode: 'insensitive' } },
          { title:      { contains: search, mode: 'insensitive' } },
          { browserApp: { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    },
    orderBy: { visitedAt: 'desc' },
    take: limit,
  });
  res.json(history);
});

// ── Remote Commands ────────────────────────────────────────────────────────────

const IssueCommandSchema = z.object({
  deviceId:    z.string().min(1),
  commandType: z.string().min(1),
  payload:     z.record(z.unknown()).optional(),
});

// POST /api/user/commands — user issues a command to their own device
router.post('/commands', authenticate, async (req, res) => {
  const parsed = IssueCommandSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { deviceId, commandType, payload } = parsed.data;
  const device = await ownDevice(deviceId, req.auth.userId);
  if (!device) { res.status(403).json({ error: 'Forbidden' }); return; }

  const cmd = await prisma.remoteCommand.create({
    data: { deviceId, commandType, payload: JSON.stringify(payload ?? {}) },
  });
  res.status(201).json(cmd);
});

// GET /api/user/commands?deviceId=xxx — user sees their command history
router.get('/commands', authenticate, async (req, res) => {
  const deviceId = req.query.deviceId as string;
  if (!deviceId) { res.status(400).json({ error: 'deviceId required' }); return; }

  const device = await ownDevice(deviceId, req.auth.userId);
  if (!device) { res.status(403).json({ error: 'Forbidden' }); return; }

  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const cmds = await prisma.remoteCommand.findMany({
    where:   { deviceId },
    orderBy: { issuedAt: 'desc' },
    take:    limit,
  });
  res.json(cmds);
});

// ── Geofences ─────────────────────────────────────────────────────────────────

const GeofenceSchema = z.object({
  deviceId:  z.string().min(1),
  name:      z.string().min(1),
  latitude:  z.number(),
  longitude: z.number(),
  radiusM:   z.number().min(50).max(50000),
});

// GET /api/user/geofences?deviceId=xxx
router.get('/geofences', authenticate, async (req, res) => {
  const deviceId = req.query.deviceId as string;
  if (!deviceId) { res.status(400).json({ error: 'deviceId required' }); return; }

  const device = await ownDevice(deviceId, req.auth.userId);
  if (!device) { res.status(403).json({ error: 'Forbidden' }); return; }

  const zones = await prisma.geofence.findMany({
    where:   { deviceId },
    include: { alerts: { orderBy: { triggeredAt: 'desc' }, take: 5 } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(zones);
});

// POST /api/user/geofences
router.post('/geofences', authenticate, async (req, res) => {
  const parsed = GeofenceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { deviceId, name, latitude, longitude, radiusM } = parsed.data;
  const device = await ownDevice(deviceId, req.auth.userId);
  if (!device) { res.status(403).json({ error: 'Forbidden' }); return; }

  const zone = await prisma.geofence.create({
    data: { deviceId, name, latitude, longitude, radiusM },
  });
  res.status(201).json(zone);
});

// PATCH /api/user/geofences/:id
router.patch('/geofences/:id', authenticate, async (req, res) => {
  const zone = await prisma.geofence.findUnique({ where: { id: req.params.id as string } });
  if (!zone) { res.status(404).json({ error: 'Not found' }); return; }

  const device = await ownDevice(zone.deviceId, req.auth.userId);
  if (!device) { res.status(403).json({ error: 'Forbidden' }); return; }

  const { isActive, name, radiusM } = req.body as { isActive?: boolean; name?: string; radiusM?: number };
  const updated = await prisma.geofence.update({
    where: { id: zone.id },
    data: {
      ...(isActive !== undefined ? { isActive } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(radiusM !== undefined ? { radiusM } : {}),
    },
  });
  res.json(updated);
});

// DELETE /api/user/geofences/:id
router.delete('/geofences/:id', authenticate, async (req, res) => {
  const zone = await prisma.geofence.findUnique({ where: { id: req.params.id as string } });
  if (!zone) { res.status(404).json({ error: 'Not found' }); return; }

  const device = await ownDevice(zone.deviceId, req.auth.userId);
  if (!device) { res.status(403).json({ error: 'Forbidden' }); return; }

  await prisma.$transaction([
    prisma.geofenceAlert.deleteMany({ where: { geofenceId: zone.id } }),
    prisma.geofence.delete({ where: { id: zone.id } }),
  ]);
  res.json({ ok: true });
});

// ── App Block Rules ────────────────────────────────────────────────────────────

const AppBlockSchema = z.object({
  deviceId:    z.string().min(1),
  packageName: z.string().min(1),
  appName:     z.string().min(1),
  isBlocked:   z.boolean().optional().default(true),
});

// GET /api/user/app-blocks?deviceId=xxx
router.get('/app-blocks', authenticate, async (req, res) => {
  const deviceId = req.query.deviceId as string;
  if (!deviceId) { res.status(400).json({ error: 'deviceId required' }); return; }

  const device = await ownDevice(deviceId, req.auth.userId);
  if (!device) { res.status(403).json({ error: 'Forbidden' }); return; }

  const rules = await prisma.appBlockRule.findMany({
    where:   { deviceId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(rules);
});

// POST /api/user/app-blocks
router.post('/app-blocks', authenticate, async (req, res) => {
  const parsed = AppBlockSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { deviceId, packageName, appName, isBlocked } = parsed.data;
  const device = await ownDevice(deviceId, req.auth.userId);
  if (!device) { res.status(403).json({ error: 'Forbidden' }); return; }

  const rule = await prisma.appBlockRule.upsert({
    where:  { deviceId_packageName: { deviceId, packageName } },
    update: { isBlocked, appName },
    create: { deviceId, packageName, appName, isBlocked: isBlocked ?? true },
  });
  res.status(201).json(rule);
});

// PATCH /api/user/app-blocks/:id
router.patch('/app-blocks/:id', authenticate, async (req, res) => {
  const rule = await prisma.appBlockRule.findUnique({ where: { id: req.params.id as string } });
  if (!rule) { res.status(404).json({ error: 'Not found' }); return; }

  const device = await ownDevice(rule.deviceId, req.auth.userId);
  if (!device) { res.status(403).json({ error: 'Forbidden' }); return; }

  const { isBlocked } = req.body as { isBlocked: boolean };
  const updated = await prisma.appBlockRule.update({
    where: { id: rule.id },
    data:  { isBlocked },
  });
  res.json(updated);
});

// DELETE /api/user/app-blocks/:id
router.delete('/app-blocks/:id', authenticate, async (req, res) => {
  const rule = await prisma.appBlockRule.findUnique({ where: { id: req.params.id as string } });
  if (!rule) { res.status(404).json({ error: 'Not found' }); return; }

  const device = await ownDevice(rule.deviceId, req.auth.userId);
  if (!device) { res.status(403).json({ error: 'Forbidden' }); return; }

  await prisma.appBlockRule.delete({ where: { id: rule.id } });
  res.json({ ok: true });
});

export default router;
