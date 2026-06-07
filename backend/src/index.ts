import 'dotenv/config';
import path from 'path';
import express from 'express';
import { prisma } from './config/database';
import { createServer } from 'http';
import cors from 'cors';
import passport from 'passport';
import { initPassport } from './config/passport';
import { initSocket } from './config/socket';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import devicesRouter from './routes/devices';
import eventsRouter from './routes/events';
import locationRouter from './routes/location';
import usageRouter from './routes/usage';
import notificationsRouter from './routes/notifications';
import commandsRouter, { RECORDINGS_DIR } from './routes/commands';
import galleryRouter, { GALLERY_UPLOADS_DIR } from './routes/gallery';
import fcmRouter from './routes/fcm';
import subscriptionRouter from './routes/subscriptions';
import downloadsRouter from './routes/downloads';
import consentRouter from './routes/consent';
import userRouter from './routes/user';
import inquiriesRouter from './routes/inquiries';

const app = express();
const httpServer = createServer(app);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Serve uploaded gallery images as static files
app.use('/uploads/gallery',     express.static(GALLERY_UPLOADS_DIR));
// Serve screen recordings
app.use('/uploads/recordings',  express.static(RECORDINGS_DIR));

// Initialize Passport strategies (Local + JWT)
initPassport();
app.use(passport.initialize());

// Initialize Socket.IO
initSocket(httpServer);

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/events', eventsRouter);
app.use('/api/location', locationRouter);
app.use('/api/usage', usageRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/commands',     commandsRouter);
app.use('/api/gallery',      galleryRouter);
app.use('/api/fcm',          fcmRouter);
// Razorpay webhook needs raw JSON body for signature verification
app.use('/api/subscription/webhook', express.json());
app.use('/api/subscription', subscriptionRouter);
app.use('/api/downloads',   downloadsRouter);
app.use('/api/consent',     consentRouter);
app.use('/api/user',        userRouter);
app.use('/api/inquiries',   inquiriesRouter);

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Auto-expire subscriptions (runs every hour) ───────────────────────────────
async function autoExpireSubscriptions() {
  try {
    const { count } = await prisma.userSubscription.updateMany({
      where: { status: 'active', expiresAt: { lt: new Date() } },
      data:  { status: 'expired' },
    });
    if (count > 0) console.log(`[subscription] Auto-expired ${count} subscription(s)`);
  } catch (e) {
    console.error('[subscription] Auto-expire error:', e);
  }
}
// Run immediately on startup, then every hour
autoExpireSubscriptions();
setInterval(autoExpireSubscriptions, 60 * 60 * 1000);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3000);
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Parental Monitor API  →  http://0.0.0.0:${PORT}  (LAN reachable)`);
  console.log(`✓ Auth strategy         →  Passport JWT + Local`);
  console.log(`✓ Database              →  PostgreSQL via Prisma`);
});
