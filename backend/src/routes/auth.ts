import { Request, Response, NextFunction, Router } from 'express';
import passport from 'passport';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/database';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret';
const JWT_EXPIRES = '30d';

function signToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

// ── Validation schemas ────────────────────────────────────────────────────────

const RegisterSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  deviceId: z.string().min(1, 'Device ID is required'),
  deviceName: z.string().min(1, 'Device name is required'),
  deviceRole: z.enum(['child', 'parent']),
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
  deviceId: z.string().optional(),
  deviceName: z.string().optional(),
});

// ── POST /api/auth/register ───────────────────────────────────────────────────

router.post('/register', async (req: Request, res: Response) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }

  const { name, email, password, deviceId, deviceName, deviceRole } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: deviceRole === 'parent' ? 'parent' : 'child',
      devices: {
        create: { deviceId, name: deviceName, role: deviceRole },
      },
    },
  });

  const token = signToken(user.id, user.role);

  res.status(201).json({
    token,
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
  });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
// Uses Passport Local strategy for credential validation

router.post(
  '/login',
  (req: Request, res: Response, next: NextFunction) => {
    // Validate input first
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }
    next();
  },
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate(
      'local',
      { session: false },
      async (
        err: Error | null,
        user: { userId: string; role: string; dbId: string } | false,
        info: { message: string } | undefined,
      ) => {
        if (err) return next(err);
        if (!user) {
          res.status(401).json({ error: info?.message ?? 'Invalid credentials' });
          return;
        }

        // Admin accounts must use the admin portal — block them here
        if (user.role === 'admin') {
          res.status(401).json({ error: 'Invalid credentials' });
          return;
        }

        // Auto-register device if new, or update lastSeen if already known
        const { deviceId, deviceName } = req.body as { deviceId?: string; deviceName?: string };
        if (deviceId) {
          const existing = await prisma.device.findUnique({ where: { deviceId } });
          if (existing) {
            // Device exists — verify it belongs to this user
            if (existing.userId !== user.userId) {
              res.status(409).json({ error: 'Device is registered to a different account' });
              return;
            }
            await prisma.device.update({
              where: { deviceId },
              data: { lastSeen: new Date(), isOnline: true },
            });
          } else {
            // New device — register it under this user
            await prisma.device.create({
              data: {
                deviceId,
                name: deviceName ?? 'Unknown Device',
                role: 'child',
                userId: user.userId,
                isOnline: true,
                lastSeen: new Date(),
              },
            });
          }
        }

        const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
        const token = signToken(user.userId, user.role);

        res.json({
          token,
          userId: user.userId,
          role: user.role,
          deviceId: deviceId ?? null,
          name: dbUser?.name ?? '',
          email: dbUser?.email ?? '',
        });
      },
    )(req, res, next);
  },
);

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
// Stateless JWT — client just discards the token. Mark device offline.

router.post('/logout', async (req: Request, res: Response) => {
  const { deviceId } = req.body as { deviceId?: string };
  if (deviceId) {
    await prisma.device.updateMany({
      where: { deviceId },
      data: { isOnline: false },
    });
  }
  res.json({ ok: true });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Returns current user info from a valid JWT

router.get(
  '/me',
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate(
      'jwt',
      { session: false },
      async (err: Error | null, user: { userId: string; role: string } | false) => {
        if (err) return next(err);
        if (!user) {
          res.status(401).json({ error: 'Invalid or expired token' });
          return;
        }
        const dbUser = await prisma.user.findUnique({
          where: { id: user.userId },
          include: { devices: true },
        });
        if (!dbUser) {
          res.status(404).json({ error: 'User not found' });
          return;
        }
        res.json({
          userId: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.role,
          devices: dbUser.devices,
        });
      },
    )(req, res, next);
  },
);

export default router;
