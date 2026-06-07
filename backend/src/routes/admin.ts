import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { GALLERY_UPLOADS_DIR } from './gallery';

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
    totalUsers, totalChildDevices, onlineDevices,
    totalLocations, totalNotifications, totalUsageLogs,
    totalCallLogs, totalSmsLogs, totalContacts, totalGalleryItems, totalBrowsing,
    newUsersToday, newDevicesToday,
    locToday, notifToday, callToday, smsToday, usageToday,
  ] = await Promise.all([
    prisma.user.count({ where: { role: { not: 'admin' } } }),
    prisma.device.count({ where: { role: 'child' } }),        // child devices only
    prisma.device.count({ where: { isOnline: true, role: 'child' } }),
    prisma.locationLog.count(),
    prisma.notificationLog.count(),
    prisma.appUsageLog.count(),
    prisma.callLog.count(),
    prisma.smsLog.count(),
    prisma.contact.count(),
    prisma.galleryItem.count(),
    prisma.browsingHistory.count(),
    prisma.user.count({ where: { createdAt: { gte: today }, role: { not: 'admin' } } }),
    prisma.device.count({ where: { registeredAt: { gte: today }, role: 'child' } }),
    prisma.locationLog.count({ where: { syncedAt: { gte: today } } }),
    prisma.notificationLog.count({ where: { syncedAt: { gte: today } } }),
    prisma.callLog.count({ where: { syncedAt: { gte: today } } }),
    prisma.smsLog.count({ where: { syncedAt: { gte: today } } }),
    prisma.appUsageLog.count({ where: { capturedAt: { gte: today } } }),
  ]);

  const syncedToday = locToday + notifToday + callToday + smsToday + usageToday;

  res.json({
    totalUsers,
    totalDevices: totalChildDevices,
    onlineDevices,
    totalLocations, totalNotifications, totalUsageLogs,
    totalCallLogs, totalSmsLogs, totalContacts, totalGalleryItems, totalBrowsing,
    newUsersToday, newDevicesToday,
    syncedToday,
  });
});

// ── GET /api/admin/devices ────────────────────────────────────────────────────
// All devices across all users, grouped by user — for the Devices management page.
router.get('/devices', authenticate, requireAdmin, async (req, res) => {
  const users = await prisma.user.findMany({
    where: { role: { not: 'admin' } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      devices: {
        orderBy: { registeredAt: 'desc' },
        select: {
          id: true,
          deviceId: true,
          name: true,
          role: true,
          isOnline: true,
          lastSeen: true,
          ipAddress: true,
          registeredAt: true,
          _count: {
            select: {
              locationLogs: true,
              notificationLogs: true,
              callLogs: true,
              smsLogs: true,
              galleryItems: true,
              browsingHistory: true,
              contacts: true,
            },
          },
        },
      },
    },
  });

  // Only return users who have at least one device
  const withDevices = users.filter((u) => u.devices.length > 0);
  res.json(withDevices);
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
                callLogs: true, smsLogs: true, contacts: true, galleryItems: true,
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
              statusLogs: true, callLogs: true, smsLogs: true, contacts: true, galleryItems: true,
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
    recentCallLogs, recentSms, contacts, galleryItems, browsingHistory, latestStatus,
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
    prisma.smsLog.findMany({
      where: dWhere, orderBy: { date: 'desc' }, take: 100,
    }),
    prisma.contact.findMany({
      where: dWhere, orderBy: { name: 'asc' }, take: 100,
    }),
    prisma.galleryItem.findMany({
      where: dWhere, orderBy: { syncedAt: 'desc' }, take: 1000,
    }),
    prisma.browsingHistory.findMany({
      where: dWhere, orderBy: { visitedAt: 'desc' }, take: 2000,
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
    recentSms,
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

// ── GET /api/admin/users/:userId/sms ─────────────────────────────────────────
router.get('/users/:userId/sms', authenticate, requireAdmin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.userId as string }, include: { devices: { select: { deviceId: true } } } });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const allDeviceIds = user.devices.map((d) => d.deviceId);
  const limit  = Math.min(Number(req.query.limit) || 200, 1000);
  const search = req.query.search as string | undefined;
  const dWhere = deviceWhere(allDeviceIds, req.query.deviceId as string | undefined);

  const messages = await prisma.smsLog.findMany({
    where: {
      ...dWhere,
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

// helper — delete all uploaded gallery files for a list of deviceIds
async function deleteGalleryFiles(deviceIds: string[]): Promise<void> {
  await Promise.all(
    deviceIds.map((id) =>
      fs.rm(path.join(GALLERY_UPLOADS_DIR, id), { recursive: true, force: true }),
    ),
  );
}

// ── DELETE /api/admin/users/:userId/data — wipe monitoring data, keep account ──
router.delete('/users/:userId/data', authenticate, requireAdmin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.userId as string } });
  if (!user || user.role === 'admin') { res.status(404).json({ error: 'User not found' }); return; }

  const deviceIds = (
    await prisma.device.findMany({ where: { userId: user.id }, select: { deviceId: true } })
  ).map((d) => d.deviceId);

  if (deviceIds.length === 0) { res.json({ ok: true, deleted: {} }); return; }

  const dWhere = { deviceId: { in: deviceIds } };

  // Delete all monitoring data but keep the user + devices
  const [locs, notifs, usage, calls, sms, contacts, gallery, browsing, cmds, status] =
    await prisma.$transaction([
      prisma.locationLog.deleteMany({ where: dWhere }),
      prisma.notificationLog.deleteMany({ where: dWhere }),
      prisma.appUsageLog.deleteMany({ where: dWhere }),
      prisma.callLog.deleteMany({ where: dWhere }),
      prisma.smsLog.deleteMany({ where: dWhere }),
      prisma.contact.deleteMany({ where: dWhere }),
      prisma.galleryItem.deleteMany({ where: dWhere }),
      prisma.browsingHistory.deleteMany({ where: dWhere }),
      prisma.remoteCommand.deleteMany({ where: dWhere }),
      prisma.deviceStatusLog.deleteMany({ where: dWhere }),
    ]);

  await deleteGalleryFiles(deviceIds);

  res.json({
    ok: true,
    deleted: {
      locations: locs.count, notifications: notifs.count, appUsage: usage.count,
      callLogs: calls.count, smsLogs: sms.count, contacts: contacts.count,
      galleryItems: gallery.count, browsingHistory: browsing.count,
      commands: cmds.count, statusLogs: status.count,
    },
  });
});

// ── DELETE /api/admin/devices/:deviceId/data — wipe device monitoring data ────
router.delete('/devices/:deviceId/data', authenticate, requireAdmin, async (req, res) => {
  const deviceId = String(req.params.deviceId);
  const device = await prisma.device.findUnique({ where: { deviceId } });
  if (!device) { res.status(404).json({ error: 'Device not found' }); return; }

  const dWhere = { deviceId };
  const [locs, notifs, usage, calls, sms, contacts, gallery, browsing, cmds, status] =
    await prisma.$transaction([
      prisma.locationLog.deleteMany({ where: dWhere }),
      prisma.notificationLog.deleteMany({ where: dWhere }),
      prisma.appUsageLog.deleteMany({ where: dWhere }),
      prisma.callLog.deleteMany({ where: dWhere }),
      prisma.smsLog.deleteMany({ where: dWhere }),
      prisma.contact.deleteMany({ where: dWhere }),
      prisma.galleryItem.deleteMany({ where: dWhere }),
      prisma.browsingHistory.deleteMany({ where: dWhere }),
      prisma.remoteCommand.deleteMany({ where: dWhere }),
      prisma.deviceStatusLog.deleteMany({ where: dWhere }),
    ]);

  await deleteGalleryFiles([deviceId]);

  res.json({
    ok: true,
    deleted: {
      locations: locs.count, notifications: notifs.count, appUsage: usage.count,
      callLogs: calls.count, smsLogs: sms.count, contacts: contacts.count,
      galleryItems: gallery.count, browsingHistory: browsing.count,
      commands: cmds.count, statusLogs: status.count,
    },
  });
});

// ── DELETE /api/admin/users/:userId ──────────────────────────────────────────
router.delete('/users/:userId', authenticate, requireAdmin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.userId as string } });
  if (!user || user.role === 'admin') {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const deviceIds = (
    await prisma.device.findMany({ where: { userId: user.id }, select: { deviceId: true } })
  ).map((d) => d.deviceId);

  // Delete uploaded gallery files from disk first, then the DB row.
  // CASCADE deletes on the DB handle every child table automatically.
  await deleteGalleryFiles(deviceIds);
  await prisma.user.delete({ where: { id: user.id } });

  res.json({ ok: true });
});

// ── DELETE /api/admin/devices/:deviceId ───────────────────────────────────────
router.delete('/devices/:deviceId', authenticate, requireAdmin, async (req, res) => {
  const deviceId = String(req.params.deviceId);

  const device = await prisma.device.findUnique({ where: { deviceId } });
  if (!device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  await deleteGalleryFiles([deviceId]);

  // Delete geofences (and their alerts via cascade) before deleting the device.
  // The DB constraint is RESTRICT; we remove child rows explicitly here as a
  // belt-and-suspenders guard until the schema migration (onDelete: Cascade) is applied.
  await prisma.geofenceAlert.deleteMany({
    where: { geofence: { deviceId } },
  });
  await prisma.geofence.deleteMany({ where: { deviceId } });

  await prisma.device.delete({ where: { deviceId } });

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
  const { packageName, appName, isBlocked = true, ruleType = 'block' } = req.body as {
    packageName: string; appName: string; isBlocked?: boolean; ruleType?: string;
  };
  if (!packageName || !appName) {
    res.status(400).json({ error: 'packageName and appName required' }); return;
  }

  const device = await prisma.device.findUnique({ where: { deviceId: req.params.deviceId as string } });
  if (!device) { res.status(404).json({ error: 'Device not found' }); return; }

  const rule = await (prisma.appBlockRule as any).upsert({
    where:  { deviceId_packageName: { deviceId: device.deviceId, packageName } },
    update: { isBlocked, appName, ruleType },
    create: { deviceId: device.deviceId, packageName, appName, isBlocked, ruleType },
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
