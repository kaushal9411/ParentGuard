import { Router } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const router = Router();

// Current consent version — bump when consent text changes so old consents
// are flagged as outdated and users must re-agree.
export const CONSENT_VERSION = '1.0';

// ── POST /api/consent/record ──────────────────────────────────────────────────
// Called by the user portal immediately after they check all boxes and click
// "I Agree & Download". Records the full audit trail.
router.post('/record', authenticate, async (req, res) => {
  const { items, purpose } = req.body as {
    items?: string[];
    purpose?: string;
  };

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'items array required' });
    return;
  }

  const ip        = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
                    ?? req.socket.remoteAddress
                    ?? null;
  const userAgent = req.headers['user-agent'] ?? null;

  const log = await prisma.consentLog.create({
    data: {
      userId:          req.auth.userId,
      consentVersion:  CONSENT_VERSION,
      items:           JSON.stringify(items),
      ipAddress:       ip,
      userAgent,
      purpose:         purpose ?? 'app_download',
    },
  });

  res.json({
    consentId:  log.id,
    grantedAt:  log.grantedAt,
    version:    log.consentVersion,
  });
});

// ── GET /api/consent/my ───────────────────────────────────────────────────────
// User checks their own consent history
router.get('/my', authenticate, async (req, res) => {
  const logs = await prisma.consentLog.findMany({
    where:   { userId: req.auth.userId },
    orderBy: { grantedAt: 'desc' },
    take: 10,
  });
  res.json(logs.map((l) => ({
    id:             l.id,
    consentVersion: l.consentVersion,
    purpose:        l.purpose,
    grantedAt:      l.grantedAt,
    revokedAt:      l.revokedAt,
    isValid:        !l.revokedAt && l.consentVersion === CONSENT_VERSION,
    items:          JSON.parse(l.items) as string[],
  })));
});

// ── GET /api/admin/consent ────────────────────────────────────────────────────
// Admin audit view — all consent records across all users
router.get('/admin', authenticate, requireAdmin, async (_req, res) => {
  const logs = await prisma.consentLog.findMany({
    orderBy: { grantedAt: 'desc' },
    take:    500,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  res.json(logs.map((l) => ({
    id:             l.id,
    user:           l.user,
    consentVersion: l.consentVersion,
    purpose:        l.purpose,
    ipAddress:      l.ipAddress,
    grantedAt:      l.grantedAt,
    revokedAt:      l.revokedAt,
    isValid:        !l.revokedAt && l.consentVersion === CONSENT_VERSION,
    items:          JSON.parse(l.items) as string[],
  })));
});

export default router;
