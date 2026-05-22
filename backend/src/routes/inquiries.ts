import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const router = Router();

const CreateSchema = z.object({
  name:    z.string().min(1).max(120),
  email:   z.string().email().max(200),
  phone:   z.string().max(20).optional(),
  message: z.string().min(1).max(2000),
});

// POST /api/inquiries — public, no auth
router.post('/', async (req, res) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const inquiry = await prisma.inquiry.create({ data: parsed.data });
  res.status(201).json({ ok: true, id: inquiry.id });
});

// GET /api/inquiries — admin only
router.get('/', authenticate, requireAdmin, async (req, res) => {
  const status = req.query.status as string | undefined;
  const inquiries = await prisma.inquiry.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
  });
  res.json(inquiries);
});

// PATCH /api/inquiries/:id — admin updates status / notes
router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
  const { status, notes } = req.body as { status?: string; notes?: string };
  const inquiry = await prisma.inquiry.findUnique({ where: { id: req.params.id as string } });
  if (!inquiry) { res.status(404).json({ error: 'Not found' }); return; }

  const updated = await prisma.inquiry.update({
    where: { id: inquiry.id },
    data: {
      ...(status !== undefined ? { status } : {}),
      ...(notes  !== undefined ? { notes  } : {}),
    },
  });
  res.json(updated);
});

// DELETE /api/inquiries/:id — admin deletes
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  await prisma.inquiry.deleteMany({ where: { id: req.params.id as string } });
  res.json({ ok: true });
});

export default router;
