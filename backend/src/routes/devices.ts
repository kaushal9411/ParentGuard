import { Router } from 'express';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { checkDeviceLimit } from '../middleware/feature';
import { GALLERY_UPLOADS_DIR } from './gallery';

const router = Router();

const CreateDeviceSchema = z.object({
  deviceId:   z.string().min(1),
  deviceName: z.string().min(1),
  deviceRole: z.enum(['child', 'parent']),
});

// POST /api/devices — web portal creates a child device
router.post('/', authenticate, checkDeviceLimit, async (req, res) => {
  const parsed = CreateDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { deviceId, deviceName, deviceRole } = parsed.data;

  const existing = await prisma.device.findUnique({ where: { deviceId } });
  if (existing) {
    res.status(409).json({ error: 'A device with this ID already exists' });
    return;
  }

  const device = await prisma.device.create({
    data: {
      deviceId,
      name: deviceName,
      role: deviceRole,
      userId: req.auth.userId,
    },
  });

  res.status(201).json(device);
});

// GET /api/devices — list all devices for the authenticated user
router.get('/', authenticate, async (req, res) => {
  const devices = await prisma.device.findMany({
    where: { userId: req.auth.userId },
    orderBy: { registeredAt: 'desc' },
  });
  res.json(devices);
});

// GET /api/devices/:deviceId — single device details
router.get('/:deviceId', authenticate, async (req, res) => {
  const device = await prisma.device.findFirst({
    where: { deviceId: req.params.deviceId as string, userId: req.auth.userId },
  });
  if (!device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }
  res.json(device);
});

// PATCH /api/devices/:deviceId/status — mark device online/offline
router.patch('/:deviceId/status', authenticate, async (req, res) => {
  const { isOnline } = req.body as { isOnline?: boolean };
  const result = await prisma.device.updateMany({
    where: { deviceId: req.params.deviceId as string, userId: req.auth.userId },
    data: { isOnline: isOnline ?? false, lastSeen: new Date() },
  });
  if (result.count === 0) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }
  res.json({ ok: true });
});

// DELETE /api/devices/:deviceId — device removes itself (or user removes own device)
router.delete('/:deviceId', authenticate, async (req, res) => {
  const deviceId = String(req.params.deviceId);

  const device = await prisma.device.findFirst({
    where: { deviceId, userId: req.auth.userId },
  });
  if (!device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  // Clean up uploaded gallery files then let CASCADE handle all DB rows
  await fs.rm(path.join(GALLERY_UPLOADS_DIR, deviceId), { recursive: true, force: true });
  await prisma.device.delete({ where: { deviceId } });

  res.json({ ok: true });
});

export default router;
