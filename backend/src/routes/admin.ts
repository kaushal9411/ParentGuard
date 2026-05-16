import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret';

// ── POST /api/admin/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== 'admin') {
    res.status(401).json({ error: 'Invalid admin credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid admin credentials' });
    return;
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, userId: user.id, name: user.name, email: user.email, role: user.role });
});

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', authenticate, requireAdmin, async (_req, res) => {
  const [totalUsers, totalDevices, onlineDevices, totalLocations, totalNotifications, totalUsageLogs] =
    await Promise.all([
      prisma.user.count({ where: { role: { not: 'admin' } } }),
      prisma.device.count(),
      prisma.device.count({ where: { isOnline: true } }),
      prisma.locationLog.count(),
      prisma.notificationLog.count(),
      prisma.appUsageLog.count(),
    ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [newUsersToday, newDevicesToday, logsToday] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: today }, role: { not: 'admin' } } }),
    prisma.device.count({ where: { registeredAt: { gte: today } } }),
    prisma.locationLog.count({ where: { syncedAt: { gte: today } } }),
  ]);

  res.json({
    totalUsers,
    totalDevices,
    onlineDevices,
    totalLocations,
    totalNotifications,
    totalUsageLogs,
    newUsersToday,
    newDevicesToday,
    logsToday,
  });
});

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  const search = req.query.search as string | undefined;
  const page   = Math.max(1, Number(req.query.page) || 1);
  const limit  = 20;
  const skip   = (page - 1) * limit;

  const where = {
    role: { not: 'admin' as const },
    ...(search
      ? {
          OR: [
            { name:  { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        devices: {
          select: {
            id: true, deviceId: true, name: true,
            role: true, isOnline: true, lastSeen: true, registeredAt: true,
            _count: {
              select: { locationLogs: true, appUsageLogs: true, notificationLogs: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ users, total, page, pages: Math.ceil(total / limit) });
});

// ── GET /api/admin/users/:userId ──────────────────────────────────────────────
router.get('/users/:userId', authenticate, requireAdmin, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
    include: {
      devices: {
        include: {
          _count: {
            select: { locationLogs: true, appUsageLogs: true, notificationLogs: true, statusLogs: true },
          },
        },
      },
    },
  });

  if (!user || user.role === 'admin') {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Recent activity across all devices
  const deviceIds = user.devices.map((d) => d.deviceId);

  const [recentLocations, recentNotifications, recentUsage] = await Promise.all([
    prisma.locationLog.findMany({
      where: { deviceId: { in: deviceIds } },
      orderBy: { capturedAt: 'desc' },
      take: 10,
    }),
    prisma.notificationLog.findMany({
      where: { deviceId: { in: deviceIds } },
      orderBy: { postedAt: 'desc' },
      take: 10,
    }),
    prisma.appUsageLog.findMany({
      where: { deviceId: { in: deviceIds } },
      orderBy: { capturedAt: 'desc' },
      take: 10,
      select: { id: true, deviceId: true, appName: true, packageName: true, usageDurationMs: true, capturedAt: true },
    }),
  ]);

  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt },
    devices: user.devices,
    recentLocations,
    recentNotifications,
    recentUsage: recentUsage.map((u) => ({ ...u, usageDurationMs: u.usageDurationMs.toString() })),
  });
});

// ── DELETE /api/admin/users/:userId ──────────────────────────────────────────
router.delete('/users/:userId', authenticate, requireAdmin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!user || user.role === 'admin') {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Cascade: delete logs → devices → user
  const deviceIds = (await prisma.device.findMany({
    where: { userId: user.id }, select: { deviceId: true },
  })).map((d) => d.deviceId);

  await prisma.$transaction([
    prisma.locationLog.deleteMany({ where: { deviceId: { in: deviceIds } } }),
    prisma.appUsageLog.deleteMany({ where: { deviceId: { in: deviceIds } } }),
    prisma.notificationLog.deleteMany({ where: { deviceId: { in: deviceIds } } }),
    prisma.deviceStatusLog.deleteMany({ where: { deviceId: { in: deviceIds } } }),
    prisma.device.deleteMany({ where: { userId: user.id } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  res.json({ ok: true });
});

export default router;
