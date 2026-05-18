import 'dotenv/config';
import path from 'path';
import express from 'express';
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
import commandsRouter from './routes/commands';
import galleryRouter, { GALLERY_UPLOADS_DIR } from './routes/gallery';

const app = express();
const httpServer = createServer(app);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Serve uploaded gallery images as static files
app.use('/uploads/gallery', express.static(GALLERY_UPLOADS_DIR));

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

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3000);
httpServer.listen(PORT, () => {
  console.log(`✓ Parental Monitor API  →  http://localhost:${PORT}`);
  console.log(`✓ Auth strategy         →  Passport JWT + Local`);
  console.log(`✓ Database              →  PostgreSQL via Prisma`);
});
