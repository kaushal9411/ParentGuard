import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/database';

const router = Router();

// POST /api/fcm/register — upsert FCM token for the authenticated user
router.post('/register', authenticate, async (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'token required' });
    return;
  }

  await prisma.fcmToken.upsert({
    where:  { token },
    create: { userId: req.auth.userId, token },
    update: { userId: req.auth.userId },
  });

  res.json({ success: true });
});

// DELETE /api/fcm/unregister — remove FCM token on logout
router.delete('/unregister', authenticate, async (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token) {
    res.status(400).json({ error: 'token required' });
    return;
  }

  await prisma.fcmToken.deleteMany({
    where: { token, userId: req.auth.userId },
  });

  res.json({ success: true });
});

export default router;
