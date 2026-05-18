import express, { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/database';

const router = Router();

export const GALLERY_UPLOADS_DIR = path.join(__dirname, '../../uploads/gallery');

const MIME_EXT: Record<string, string> = {
  'image/jpeg':      '.jpg',
  'image/png':       '.png',
  'image/webp':      '.webp',
  'video/mp4':       '.mp4',
  'video/3gpp':      '.3gp',
  'video/3gpp2':     '.3g2',
  'video/mpeg':      '.mpeg',
  'video/quicktime': '.mov',
  'video/webm':      '.webm',
  'video/x-msvideo': '.avi',
};

// POST /api/gallery/upload/:itemId
// Body: { deviceId: string, imageData: string (base64), mimeType?: string }
router.post('/upload/:itemId', authenticate, async (req, res) => {
  const { itemId } = req.params;
  const { deviceId, imageData, mimeType } = req.body as {
    deviceId?: string; imageData?: string; mimeType?: string;
  };

  if (!deviceId || !imageData) {
    res.status(400).json({ error: 'deviceId and imageData required' });
    return;
  }

  const device = await prisma.device.findFirst({
    where: { deviceId, userId: req.auth.userId },
  });
  if (!device) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const dir = path.join(GALLERY_UPLOADS_DIR, deviceId);
  await fs.mkdir(dir, { recursive: true });

  const ext      = (mimeType && MIME_EXT[mimeType]) ?? '.jpg';
  const fileName = `${itemId}${ext}`;
  const filePath = path.join(dir, fileName);
  const buffer   = Buffer.from(imageData, 'base64');
  await fs.writeFile(filePath, buffer);

  const imageUrl = `/uploads/gallery/${deviceId}/${fileName}`;

  await prisma.galleryItem.updateMany({
    where: { id: String(itemId), deviceId: String(deviceId) },
    data: { imageUrl },
  });

  res.json({ success: true, imageUrl });
});

// POST /api/gallery/upload-video/:itemId
// Called by the native Kotlin VideoUploadService (no base64 — raw binary body).
// Headers: Authorization Bearer, X-Device-Id, Content-Type (video/*)
// Body: raw binary video data
router.post(
  '/upload-video/:itemId',
  express.raw({ type: () => true, limit: '500mb' }),
  authenticate,
  async (req, res) => {
    const { itemId }  = req.params;
    const deviceId    = req.headers['x-device-id'] as string | undefined;
    const mimeType    = (req.headers['content-type'] as string | undefined) ?? 'video/mp4';

    if (!deviceId) {
      res.status(400).json({ error: 'X-Device-Id header required' });
      return;
    }

    if (!(req.body instanceof Buffer) || req.body.length === 0) {
      res.status(400).json({ error: 'Empty video body' });
      return;
    }

    const device = await prisma.device.findFirst({
      where: { deviceId, userId: req.auth.userId },
    });
    if (!device) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const ext      = MIME_EXT[mimeType.split(';')[0].trim()] ?? '.mp4';
    const fileName = `${itemId}${ext}`;
    const dir      = path.join(GALLERY_UPLOADS_DIR, deviceId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, fileName), req.body as Buffer);

    const imageUrl = `/uploads/gallery/${deviceId}/${fileName}`;

    // Upsert so upload works even if metadata hasn't been ingested yet.
    await prisma.galleryItem.upsert({
      where:  { id: String(itemId) },
      update: { imageUrl },
      create: {
        id:        String(itemId),
        deviceId,
        fileName,
        mimeType:  mimeType.split(';')[0].trim(),
        sizeBytes: BigInt(req.body.length),
        imageUrl,
      },
    });

    res.json({ success: true, imageUrl });
  },
);

export default router;
