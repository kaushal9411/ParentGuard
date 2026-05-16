import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const router  = Router();
const JWT_SEC = process.env.JWT_SECRET ?? 'dev_secret';

/** Returns a Prisma `where` clause fragment that filters by one device or all. */
function deviceWhere(allDeviceIds: string[], queryDeviceId?: string) {
  if (queryDeviceId && allDeviceIds.includes(queryDeviceId)) {
    return { deviceId: queryDeviceId };
  }
  return { deviceId: { in: allDeviceIds } };
}

// ── POST /api/admin/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) { res.status(400).json({ error: 'Email and password required' }); return; }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== 'admin' || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: 'Invalid admin credentials' }); return;
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SEC, { expiresIn: '12h' });
  res.json({ token, userId: user.id, name: user.name, email: user.email, role: user.role });
});

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', authenticate, requireAdmin, async (_req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [
    totalUsers, totalDevices, onlineDevices,
    totalLocations, totalNotifications, totalUsageLogs,
    totalCallLogs, totalContacts, totalGalleryItems,
    newUsersToday, newDevicesToday, logsToday,
  ] = await Promise.all([
    prisma.user.count({ where: { role: { not: 'admin' } } }),
    prisma.device.count(),
    prisma.device.count({ where: { isOnline: true } }),
    prisma.locationLog.count(),
    prisma.notificationLog.count(),
    prisma.appUsageLog.count(),
    prisma.callLog.count(),
    prisma.contact.count(),
    prisma.galleryItem.count(),
    prisma.user.count({ where: { createdAt: { gte: today }, role: { not: 'admin' } } }),
    prisma.device.count({ where: { registeredAt: { gte: today } } }),
    prisma.locationLog.count({ where: { syncedAt: { gte: today } } }),
  ]);

  res.json({
    totalUsers, totalDevices, onlineDevices,
    totalLocations, totalNotifications, totalUsageLogs,
    totalCallLogs, totalContacts, totalGalleryItems,
    newUsersToday, newDevicesToday, logsToday,
  });
});

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  const search = req.query.search as string | undefined;
  const page   = Math.max(1, Number(req.query.page) || 1);
  const limit  = 20;

  const where = {
    role: { not: 'admin' as const },
    ...(search ? { OR: [
      { name:  { contains: search, mode: 'insensitive' as const } },
      { email: { contains: search, mode: 'insensitive' as const } },
    ]} : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        devices: {
          select: {
            id: true, deviceId: true, name: true, role: true,
            isOnline: true, lastSeen: true, ipAddress: true, registeredAt: true,
            _count: {
              select: {
                locationLogs: true, appUsageLogs: true, notificationLogs: true,
                callLogs: true, contacts: true, galleryItems: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ users, total, page, pages: Math.ceil(total / limit) });
});

// ── GET /api/admin/users/:userId ──────────────────────────────────────────────
// Optional ?deviceId= to scope all monitoring data to one device
router.get('/users/:userId', authenticate, requireAdmin, async (req, res) => {
  const uid      = req.params.userId as string;
  const filterDev = req.query.deviceId as string | undefined;

  const user = await prisma.user.findUnique({
    where: { id: uid },
    include: {
      devices: {
        include: {
          _count: {
            select: {
              locationLogs: true, appUsageLogs: true, notificationLogs: true,
              statusLogs: true, callLogs: true, contacts: true, galleryItems: true,
              browsingHistory: true,
            },
          },
        },
      },
    },
  });

  if (!user || user.role === 'admin') { res.status(404).json({ error: 'User not found' }); return; }

  const allDeviceIds = user.devices.map((d) => d.deviceId);
  const dWhere = deviceWhere(allDeviceIds, filterDev);

  const [
    recentLocations, recentNotifications, recentUsage,
    recentCallLogs, contacts, galleryItems, browsingHistory, latestStatus,
  ] = await Promise.all([
    prisma.locationLog.findMany({
      where: dWhere, orderBy: { capturedAt: 'desc' }, take: 20,
    }),
    prisma.notificationLog.findMany({
      where: dWhere, orderBy: { postedAt: 'desc' }, take: 50,
    }),
    prisma.appUsageLog.findMany({
      where: dWhere, orderBy: { capturedAt: 'desc' }, take: 30,
    }),
    prisma.callLog.findMany({
      where: dWhere, orderBy: { timestamp: 'desc' }, take: 50,
    }),
    prisma.contact.findMany({
      where: dWhere, orderBy: { name: 'asc' }, take: 100,
    }),
    prisma.galleryItem.findMany({
      where: dWhere, orderBy: { takenAt: 'desc' }, take: 50,
    }),
    prisma.browsingHistory.findMany({
      where: dWhere, orderBy: { visitedAt: 'desc' }, take: 50,
    }),
    prisma.deviceStatusLog.findFirst({
      where: dWhere, orderBy: { capturedAt: 'desc' },
    }),
  ]);

  // Group notifications by app
  const notifByApp = recentNotifications.reduce<Record<string, typeof recentNotifications>>((acc, n) => {
    (acc[n.appName] ??= []).push(n);
    return acc;
  }, {});

  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt },
    devices: user.devices,
    latestStatus,
    recentLocations,
    notifByApp,
    recentUsage: recentUsage.map((u) => ({ ...u, usageDurationMs: u.usageDurationMs.toString() })),
    recentCallLogs,
    contacts,
    galleryItems: galleryItems.map((g) => ({ ...g, sizeBytes: g.sizeBytes.toString() })),
    browsingHistory,
  });
});

// ── GET /api/admin/users/:userId/locations ────────────────────────────────────
router.get('/users/:userId/locations', authenticate, requireAdmin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.userId as string }, include: { devices: { select: { deviceId: true } } } });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const allDeviceIds = user.devices.map((d) => d.deviceId);
  const limit = Math.min(Number(req.query.limit) || 100, 500);

  const logs = await prisma.locationLog.findMany({
    where: deviceWhere(allDeviceIds, req.query.deviceId as string | undefined),
    orderBy: { capturedAt: 'desc' },
    take: limit,
  });
  res.json(logs);
});

// ── GET /api/admin/users/:userId/calls ────────────────────────────────────────
router.get('/users/:userId/calls', authenticate, requireAdmin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.userId as string }, include: { devices: { select: { deviceId: true } } } });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const allDeviceIds = user.devices.map((d) => d.deviceId);
  const logs = await prisma.callLog.findMany({
    where: deviceWhere(allDeviceIds, req.query.deviceId as string | undefined),
    orderBy: { timestamp: 'desc' }, take: 200,
  });
  res.json(logs);
});

// ── GET /api/admin/users/:userId/gallery ──────────────────────────────────────
router.get('/users/:userId/gallery', authenticate, requireAdmin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.userId as string }, include: { devices: { select: { deviceId: true } } } });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const allDeviceIds = user.devices.map((d) => d.deviceId);
  const type = req.query.type as string | undefined;
  const dWhere = deviceWhere(allDeviceIds, req.query.deviceId as string | undefined);

  const items = await prisma.galleryItem.findMany({
    where: { ...dWhere, ...(type ? { mimeType: { startsWith: type } } : {}) },
    orderBy: { takenAt: 'desc' }, take: 200,
  });
  res.json(items.map((g) => ({ ...g, sizeBytes: g.sizeBytes.toString() })));
});

// ── DELETE /api/admin/users/:userId ──────────────────────────────────────────
router.delete('/users/:userId', authenticate, requireAdmin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.userId as string } });
  if (!user || user.role === 'admin') { res.status(404).json({ error: 'User not found' }); return; }

  const deviceIds = (await prisma.device.findMany({
    where: { userId: user.id }, select: { deviceId: true },
  })).map((d) => d.deviceId);

  await prisma.$transaction([
    prisma.locationLog.deleteMany({ where: { deviceId: { in: deviceIds } } }),
    prisma.appUsageLog.deleteMany({ where: { deviceId: { in: deviceIds } } }),
    prisma.notificationLog.deleteMany({ where: { deviceId: { in: deviceIds } } }),
    prisma.deviceStatusLog.deleteMany({ where: { deviceId: { in: deviceIds } } }),
    prisma.callLog.deleteMany({ where: { deviceId: { in: deviceIds } } }),
    prisma.contact.deleteMany({ where: { deviceId: { in: deviceIds } } }),
    prisma.galleryItem.deleteMany({ where: { deviceId: { in: deviceIds } } }),
    prisma.browsingHistory.deleteMany({ where: { deviceId: { in: deviceIds } } }),
    prisma.remoteCommand.deleteMany({ where: { deviceId: { in: deviceIds } } }),
    prisma.geofenceAlert.deleteMany({ where: { deviceId: { in: deviceIds } } }),
    prisma.geofence.deleteMany({ where: { deviceId: { in: deviceIds } } }),
    prisma.appBlockRule.deleteMany({ where: { deviceId: { in: deviceIds } } }),
    prisma.device.deleteMany({ where: { userId: user.id } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REMOTE COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

// ── POST /api/admin/devices/:deviceId/commands ────────────────────────────────
router.post('/devices/:deviceId/commands', authenticate, requireAdmin, async (req, res) => {
  const { commandType, payload } = req.body as { commandType: string; payload?: Record<string, unknown> };
  if (!commandType) { res.status(400).json({ error: 'commandType required' }); return; }

  const device = await prisma.device.findUnique({ where: { deviceId: req.params.deviceId as string } });
  if (!device) { res.status(404).json({ error: 'Device not found' }); return; }

  const cmd = await prisma.remoteCommand.create({
    data: {
      deviceId:    device.deviceId,
      commandType,
      payload:     JSON.stringify(payload ?? {}),
    },
  });
  res.status(201).json(cmd);
});

// ── GET /api/admin/devices/:deviceId/commands ─────────────────────────────────
router.get('/devices/:deviceId/commands', authenticate, requireAdmin, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const cmds = await prisma.remoteCommand.findMany({
    where:   { deviceId: req.params.deviceId as string },
    orderBy: { issuedAt: 'desc' },
    take:    limit,
  });
  res.json(cmds);
});

// ── DELETE /api/admin/commands/:commandId ─────────────────────────────────────
router.delete('/commands/:commandId', authenticate, requireAdmin, async (req, res) => {
  const cmd = await prisma.remoteCommand.findUnique({ where: { id: req.params.commandId as string } });
  if (!cmd) { res.status(404).json({ error: 'Command not found' }); return; }
  if (cmd.status !== 'pending') { res.status(409).json({ error: 'Only pending commands can be cancelled' }); return; }

  await prisma.remoteCommand.update({ where: { id: cmd.id }, data: { status: 'cancelled' } });
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GEOFENCES
// ═══════════════════════════════════════════════════════════════════════════════

// ── POST /api/admin/devices/:deviceId/geofences ───────────────────────────────
router.post('/devices/:deviceId/geofences', authenticate, requireAdmin, async (req, res) => {
  const { name, latitude, longitude, radiusM } = req.body as {
    name: string; latitude: number; longitude: number; radiusM: number;
  };
  if (!name || latitude == null || longitude == null || !radiusM) {
    res.status(400).json({ error: 'name, latitude, longitude, radiusM required' }); return;
  }

  const device = await prisma.device.findUnique({ where: { deviceId: req.params.deviceId as string } });
  if (!device) { res.status(404).json({ error: 'Device not found' }); return; }

  const zone = await prisma.geofence.create({
    data: { deviceId: device.deviceId, name, latitude, longitude, radiusM },
  });
  res.status(201).json(zone);
});

// ── GET /api/admin/devices/:deviceId/geofences ────────────────────────────────
router.get('/devices/:deviceId/geofences', authenticate, requireAdmin, async (req, res) => {
  const geofences = await prisma.geofence.findMany({
    where:   { deviceId: req.params.deviceId as string },
    include: { alerts: { orderBy: { triggeredAt: 'desc' }, take: 10 } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(geofences);
});

// ── DELETE /api/admin/geofences/:geofenceId ───────────────────────────────────
router.delete('/geofences/:geofenceId', authenticate, requireAdmin, async (req, res) => {
  const zone = await prisma.geofence.findUnique({ where: { id: req.params.geofenceId as string } });
  if (!zone) { res.status(404).json({ error: 'Geofence not found' }); return; }

  await prisma.$transaction([
    prisma.geofenceAlert.deleteMany({ where: { geofenceId: zone.id } }),
    prisma.geofence.delete({ where: { id: zone.id } }),
  ]);
  res.json({ ok: true });
});

// ── PATCH /api/admin/geofences/:geofenceId ────────────────────────────────────
router.patch('/geofences/:geofenceId', authenticate, requireAdmin, async (req, res) => {
  const { isActive } = req.body as { isActive: boolean };
  const zone = await prisma.geofence.findUnique({ where: { id: req.params.geofenceId as string } });
  if (!zone) { res.status(404).json({ error: 'Geofence not found' }); return; }

  const updated = await prisma.geofence.update({
    where: { id: zone.id },
    data:  { isActive },
  });
  res.json(updated);
});

// ═══════════════════════════════════════════════════════════════════════════════
// APP BLOCK RULES
// ═══════════════════════════════════════════════════════════════════════════════

// ── POST /api/admin/devices/:deviceId/app-blocks ──────────────────────────────
router.post('/devices/:deviceId/app-blocks', authenticate, requireAdmin, async (req, res) => {
  const { packageName, appName, isBlocked = true } = req.body as {
    packageName: string; appName: string; isBlocked?: boolean;
  };
  if (!packageName || !appName) {
    res.status(400).json({ error: 'packageName and appName required' }); return;
  }

  const device = await prisma.device.findUnique({ where: { deviceId: req.params.deviceId as string } });
  if (!device) { res.status(404).json({ error: 'Device not found' }); return; }

  const rule = await prisma.appBlockRule.upsert({
    where:  { deviceId_packageName: { deviceId: device.deviceId, packageName } },
    update: { isBlocked, appName },
    create: { deviceId: device.deviceId, packageName, appName, isBlocked },
  });
  res.status(201).json(rule);
});

// ── GET /api/admin/devices/:deviceId/app-blocks ───────────────────────────────
router.get('/devices/:deviceId/app-blocks', authenticate, requireAdmin, async (req, res) => {
  const rules = await prisma.appBlockRule.findMany({
    where:   { deviceId: req.params.deviceId as string },
    orderBy: { createdAt: 'desc' },
  });
  res.json(rules);
});

// ── DELETE /api/admin/app-blocks/:ruleId ─────────────────────────────────────
router.delete('/app-blocks/:ruleId', authenticate, requireAdmin, async (req, res) => {
  const rule = await prisma.appBlockRule.findUnique({ where: { id: req.params.ruleId as string } });
  if (!rule) { res.status(404).json({ error: 'Rule not found' }); return; }
  await prisma.appBlockRule.delete({ where: { id: rule.id } });
  res.json({ ok: true });
});

export default router;
