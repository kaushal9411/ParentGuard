import { Router } from 'express';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const router = Router();

export const APP_DIR      = path.join(__dirname, '../../uploads/app');
const APK_PATH     = path.join(APP_DIR, 'parental-monitor.apk');
const VERSION_PATH = path.join(APP_DIR, 'version.json');

async function readVersion() {
  try {
    return JSON.parse(await fs.readFile(VERSION_PATH, 'utf-8'));
  } catch {
    return { version: '1.0.0', buildType: 'debug', uploadedAt: new Date().toISOString(), notes: '' };
  }
}

// ── GET /api/downloads/app-info ───────────────────────────────────────────────
// Returns version info + file size (public — no auth needed for info)
router.get('/app-info', async (_req, res) => {
  const version = await readVersion();
  let sizeBytes = 0;
  try {
    const stat = await fs.stat(APK_PATH);
    sizeBytes = stat.size;
  } catch { /* file not yet uploaded */ }

  res.json({
    ...version,
    sizeBytes,
    sizeMb: sizeBytes ? (sizeBytes / 1_048_576).toFixed(1) : null,
    available: sizeBytes > 0,
  });
});

// ── GET /api/downloads/app ────────────────────────────────────────────────────
// Streams the APK — accepts token via query param (?auth=) for direct browser download
router.get('/app', async (req, res) => {
  // Accept Bearer header OR ?auth= query param (for direct <a download> links)
  const token = req.headers.authorization?.replace('Bearer ', '')
    ?? (req.query.auth  as string | undefined)
    ?? (req.query.token as string | undefined);
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    jwt.verify(token, process.env.JWT_SECRET ?? 'dev_secret');
  } catch { res.status(401).json({ error: 'Invalid token' }); return; }

  if (!fsSync.existsSync(APK_PATH)) {
    res.status(404).json({ error: 'APK not uploaded yet. Contact your administrator.' });
    return;
  }

  const stat    = await fs.stat(APK_PATH);
  const version = await readVersion();

  res.setHeader('Content-Type',        'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', `attachment; filename="ParentGuard-${version.version}.apk"`);
  res.setHeader('Content-Length',      stat.size);
  res.setHeader('Cache-Control',       'no-cache');

  fsSync.createReadStream(APK_PATH).pipe(res);
});

// ── POST /api/admin/upload-app ────────────────────────────────────────────────
// Admin uploads a new APK build (raw binary body, Content-Type: application/octet-stream)
// Query params: ?version=1.0.0&buildType=release&notes=...
router.post('/admin/upload', authenticate, requireAdmin,
  require('express').raw({ type: () => true, limit: '200mb' }),
  async (req, res) => {
    if (!(req.body instanceof Buffer) || req.body.length === 0) {
      res.status(400).json({ error: 'Empty APK body' });
      return;
    }

    const version   = (req.query.version   as string) || '1.0.0';
    const buildType = (req.query.buildType as string) || 'release';
    const notes     = (req.query.notes    as string) || '';

    await fs.mkdir(APP_DIR, { recursive: true });
    await fs.writeFile(APK_PATH, req.body as Buffer);

    const meta = {
      version,
      buildType,
      fileName:   'parental-monitor.apk',
      uploadedAt: new Date().toISOString(),
      notes,
    };
    await fs.writeFile(VERSION_PATH, JSON.stringify(meta, null, 2));

    res.json({
      success:  true,
      sizeMb:   ((req.body as Buffer).length / 1_048_576).toFixed(1),
      ...meta,
    });
  },
);

export default router;
