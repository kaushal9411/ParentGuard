import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { FREE_FEATURES, parseFeatures, type SubscriptionFeatures } from '../types/subscription';
import { razorpay, RAZORPAY_KEY_ID } from '../config/razorpay';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getUserFeatures(userId: string): Promise<SubscriptionFeatures> {
  const sub = await prisma.userSubscription.findUnique({
    where: { userId },
    include: { plan: true },
  });
  if (!sub || sub.status !== 'active') return FREE_FEATURES;
  if (sub.expiresAt && sub.expiresAt < new Date()) {
    // Auto-expire
    await prisma.userSubscription.update({ where: { id: sub.id }, data: { status: 'expired' } });
    return FREE_FEATURES;
  }
  return parseFeatures(sub.plan.features);
}

// ── Public — mobile/web reads its own subscription ───────────────────────────

// GET /api/subscription/my
router.get('/my', authenticate, async (req, res) => {
  const sub = await prisma.userSubscription.findUnique({
    where: { userId: req.auth.userId },
    include: { plan: { select: { id: true, name: true, description: true, price: true, durationDays: true, features: true } } },
  });

  if (!sub || sub.status !== 'active') {
    return res.json({
      plan: null,
      status: 'none',
      features: FREE_FEATURES,
    });
  }

  const expired = sub.expiresAt && sub.expiresAt < new Date();
  if (expired) {
    await prisma.userSubscription.update({ where: { id: sub.id }, data: { status: 'expired' } });
    return res.json({ plan: null, status: 'expired', features: FREE_FEATURES });
  }

  res.json({
    plan:     sub.plan,
    status:   sub.status,
    startedAt: sub.startedAt,
    expiresAt: sub.expiresAt,
    features:  parseFeatures(sub.plan.features),
  });
});

// GET /api/subscription/plans — public list for mobile onboarding
router.get('/plans', async (_req, res) => {
  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  res.json(plans.map((p) => ({ ...p, features: parseFeatures(p.features) })));
});

// ── Admin — plan management ───────────────────────────────────────────────────

const PlanSchema = z.object({
  name:        z.string().min(1).max(80),
  description: z.string().optional(),
  price:       z.number().min(0),
  durationDays: z.number().int().min(1).default(30),
  sortOrder:   z.number().int().default(0),
  features:    z.object({
    maxDevices:      z.number().int().min(1),
    location:        z.boolean(),
    notifications:   z.boolean(),
    callLogs:        z.boolean(),
    smsLogs:         z.boolean(),
    contacts:        z.boolean(),
    appUsage:        z.boolean(),
    gallery:         z.boolean(),
    browsingHistory: z.boolean(),
    geofencing:      z.boolean(),
    appBlocking:     z.boolean(),
    remoteCommands:  z.boolean(),
    historyDays:     z.number().int().min(1),
  }),
  isActive: z.boolean().default(true),
});

// GET /api/subscription/admin/plans
router.get('/admin/plans', authenticate, requireAdmin, async (_req, res) => {
  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { subscriptions: true } } },
  });
  res.json(plans.map((p) => ({ ...p, features: parseFeatures(p.features) })));
});

// POST /api/subscription/admin/plans
router.post('/admin/plans', authenticate, requireAdmin, async (req, res) => {
  const parsed = PlanSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { features, ...rest } = parsed.data;
  const plan = await prisma.subscriptionPlan.create({
    data: { ...rest, features: JSON.stringify(features) },
  });
  res.status(201).json({ ...plan, features: parseFeatures(plan.features) });
});

// PATCH /api/subscription/admin/plans/:id
router.patch('/admin/plans/:id', authenticate, requireAdmin, async (req, res) => {
  const parsed = PlanSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { features, ...rest } = parsed.data;
  const plan = await prisma.subscriptionPlan.update({
    where: { id: req.params.id as string },
    data: { ...rest, ...(features ? { features: JSON.stringify(features) } : {}) },
  });
  res.json({ ...plan, features: parseFeatures(plan.features) });
});

// DELETE /api/subscription/admin/plans/:id
router.delete('/admin/plans/:id', authenticate, requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const count = await prisma.userSubscription.count({ where: { planId: id, status: 'active' } });
  if (count > 0) {
    res.status(409).json({ error: `Cannot delete — ${count} active subscription(s) use this plan` });
    return;
  }
  await prisma.subscriptionPlan.delete({ where: { id } });
  res.json({ ok: true });
});

// ── Admin — user subscription assignment ──────────────────────────────────────

// GET /api/subscription/admin/users  — all users with their subscription
router.get('/admin/users', authenticate, requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { role: { not: 'admin' } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, email: true, role: true, createdAt: true,
      subscription: {
        include: { plan: { select: { id: true, name: true, price: true } } },
      },
    },
  });
  res.json(users);
});

const AssignSchema = z.object({
  planId:    z.string().min(1),
  // Accept any date string (datetime-local sends "2026-05-25T10:30", no timezone)
  expiresAt: z.string().optional().nullable().transform((v) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }),
  notes:     z.string().optional(),
});

// POST /api/subscription/admin/users/:userId  — assign/change subscription
router.post('/admin/users/:userId', authenticate, requireAdmin, async (req, res) => {
  const parsed = AssignSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const userId = req.params.userId as string;
  const { planId, expiresAt, notes } = parsed.data;

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) { res.status(404).json({ error: 'Plan not found' }); return; }

  // Auto-set expiresAt from plan duration if not specified
  const expiry = expiresAt
    ? new Date(expiresAt)                                       // already ISO string after transform
    : plan.durationDays > 0
      ? new Date(Date.now() + plan.durationDays * 86_400_000)
      : null;

  const sub = await prisma.userSubscription.upsert({
    where:  { userId },
    create: { userId, planId, status: 'active', startedAt: new Date(), expiresAt: expiry, assignedBy: req.auth.userId, notes: notes ?? null },
    update: { planId, status: 'active', startedAt: new Date(), expiresAt: expiry, assignedBy: req.auth.userId, notes: notes ?? null },
    include: { plan: { select: { id: true, name: true, price: true } } },
  });

  res.json({ ...sub, features: parseFeatures(plan.features) });
});

// DELETE /api/subscription/admin/users/:userId  — revoke subscription
router.delete('/admin/users/:userId', authenticate, requireAdmin, async (req, res) => {
  await prisma.userSubscription.updateMany({
    where: { userId: req.params.userId as string },
    data:  { status: 'cancelled' },
  });
  res.json({ ok: true });
});

// ── Upgrade request (user submits → admin sees it) ────────────────────────────

// GET /api/subscription/requests — admin sees all pending requests
router.get('/requests', authenticate, requireAdmin, async (_req, res) => {
  const requests = await prisma.subscriptionRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true } },
      plan:  { select: { id: true, name: true, price: true } },
    },
  });
  res.json(requests);
});

// GET /api/subscription/my-request — user checks their own request status
router.get('/my-request', authenticate, async (req, res) => {
  const request = await prisma.subscriptionRequest.findUnique({
    where: { userId: req.auth.userId },
    include: { plan: { select: { id: true, name: true, price: true } } },
  });
  if (!request) { res.status(404).json({ error: 'No request found' }); return; }
  res.json(request);
});

// POST /api/subscription/request — user requests a plan change
router.post('/request', authenticate, async (req, res) => {
  const { planId, message } = req.body as { planId?: string; message?: string };
  if (!planId) { res.status(400).json({ error: 'planId required' }); return; }

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId, isActive: true } });
  if (!plan) { res.status(404).json({ error: 'Plan not found' }); return; }

  // Upsert so the user can change their pending request
  const request = await prisma.subscriptionRequest.upsert({
    where:  { userId: req.auth.userId },
    create: { userId: req.auth.userId, planId, message: message ?? null, status: 'pending' },
    update: { planId, message: message ?? null, status: 'pending', createdAt: new Date() },
  });
  res.json(request);
});

// PATCH /api/subscription/requests/:id — admin approves or rejects
router.patch('/requests/:id', authenticate, requireAdmin, async (req, res) => {
  const { action } = req.body as { action: 'approve' | 'reject' };
  const reqId = req.params.id as string;

  const subReq = await prisma.subscriptionRequest.findUnique({
    where: { id: reqId },
    include: { plan: true },
  });
  if (!subReq) { res.status(404).json({ error: 'Request not found' }); return; }

  if (action === 'approve') {
    const expiry = subReq.plan.durationDays > 0
      ? new Date(Date.now() + subReq.plan.durationDays * 86_400_000)
      : null;
    await prisma.userSubscription.upsert({
      where:  { userId: subReq.userId },
      create: { userId: subReq.userId, planId: subReq.planId, status: 'active', expiresAt: expiry, assignedBy: req.auth.userId },
      update: { planId: subReq.planId, status: 'active', startedAt: new Date(), expiresAt: expiry, assignedBy: req.auth.userId },
    });
    await prisma.subscriptionRequest.update({ where: { id: reqId }, data: { status: 'approved' } });
  } else {
    await prisma.subscriptionRequest.update({ where: { id: reqId }, data: { status: 'rejected' } });
  }
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// RAZORPAY PAYMENT INTEGRATION
// ══════════════════════════════════════════════════════════════════════════════

// Helper — activate subscription after successful payment
async function activateSubscription(userId: string, planId: string, assignedBy?: string) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) return;
  const expiry = plan.durationDays > 0
    ? new Date(Date.now() + plan.durationDays * 86_400_000)
    : null;
  await prisma.userSubscription.upsert({
    where:  { userId },
    create: { userId, planId, status: 'active', startedAt: new Date(), expiresAt: expiry, assignedBy: assignedBy ?? null },
    update: { planId, status: 'active', startedAt: new Date(), expiresAt: expiry, assignedBy: assignedBy ?? null },
  });
  // Mark any pending upgrade request as approved
  await prisma.subscriptionRequest.updateMany({
    where: { userId, status: 'pending' },
    data:  { status: 'approved' },
  });
}

// ── POST /api/subscription/create-order ──────────────────────────────────────
// User initiates checkout — backend creates a Razorpay order
router.post('/create-order', authenticate, async (req, res) => {
  const { planId } = req.body as { planId?: string };
  if (!planId) { res.status(400).json({ error: 'planId required' }); return; }

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId, isActive: true } });
  if (!plan) { res.status(404).json({ error: 'Plan not found' }); return; }
  if (plan.price <= 0) { res.status(400).json({ error: 'Free plan does not require payment' }); return; }

  const user = await prisma.user.findUnique({ where: { id: req.auth.userId }, select: { name: true, email: true } });

  const order = await razorpay.orders.create({
    amount:   Math.round(plan.price * 100),   // Razorpay expects paise
    currency: 'INR',
    receipt:  `sub_${req.auth.userId.slice(0, 8)}_${Date.now()}`,
    notes:    { userId: req.auth.userId, planId },
  });

  // Store pending payment record
  await prisma.payment.create({
    data: {
      userId:           req.auth.userId,
      planId,
      razorpayOrderId:  order.id,
      amount:           plan.price,
      status:           'created',
      type:             'checkout',
    },
  });

  res.json({
    orderId:  order.id,
    amount:   order.amount,
    currency: order.currency,
    keyId:    RAZORPAY_KEY_ID,
    planName: plan.name,
    userName: user?.name ?? '',
    userEmail: user?.email ?? '',
  });
});

// ── POST /api/subscription/verify-payment ────────────────────────────────────
// User sends Razorpay response → backend verifies signature → activates plan
router.post('/verify-payment', authenticate, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body as { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    res.status(400).json({ error: 'Missing payment fields' });
    return;
  }

  // Verify HMAC signature
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET ?? 'nd61HKtvxcHYG8O1VIb7GYIn')
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSig !== razorpay_signature) {
    res.status(400).json({ error: 'Payment signature verification failed' });
    return;
  }

  // Find the payment record
  const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: razorpay_order_id } });
  if (!payment || payment.userId !== req.auth.userId) {
    res.status(404).json({ error: 'Payment record not found' });
    return;
  }

  // Update payment status
  await prisma.payment.update({
    where: { id: payment.id },
    data:  { razorpayPaymentId: razorpay_payment_id, status: 'paid' },
  });

  // Activate subscription
  await activateSubscription(payment.userId, payment.planId);

  res.json({ success: true, message: 'Payment verified. Subscription activated!' });
});

// ── GET /api/subscription/payment-history ────────────────────────────────────
router.get('/payment-history', authenticate, async (req, res) => {
  const payments = await prisma.payment.findMany({
    where:   { userId: req.auth.userId },
    include: { plan: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  res.json(payments);
});

// ── POST /api/subscription/admin/payment-link ─────────────────────────────────
// Admin creates a Razorpay Payment Link and sends via email + SMS to user
router.post('/admin/payment-link', authenticate, requireAdmin, async (req, res) => {
  const { userId, planId, phone, description } =
    req.body as { userId: string; planId: string; phone?: string; description?: string };

  if (!userId || !planId) {
    res.status(400).json({ error: 'userId and planId required' });
    return;
  }

  const [user, plan] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    prisma.subscriptionPlan.findUnique({ where: { id: planId, isActive: true } }),
  ]);

  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  if (!plan) { res.status(404).json({ error: 'Plan not found' }); return; }
  if (plan.price <= 0) { res.status(400).json({ error: 'Free plan has no payment' }); return; }

  const paymentLink = await (razorpay.paymentLink as any).create({
    amount:      Math.round(plan.price * 100),
    currency:    'INR',
    description: description ?? `ParentGuard ${plan.name} Plan — ${plan.durationDays} days`,
    customer:    {
      name:    user.name,
      email:   user.email,
      ...(phone ? { contact: phone.startsWith('+') ? phone : `+91${phone}` } : {}),
    },
    notify: { sms: !!phone, email: true },
    reminder_enable: true,
    callback_url: `${process.env.FRONTEND_URL ?? 'http://localhost:3001'}/dashboard/subscription?payment=success`,
    callback_method: 'get',
    notes: { userId, planId, adminId: req.auth.userId },
  });

  // Store payment record
  await prisma.payment.create({
    data: {
      userId,
      planId,
      razorpayPaymentLinkId: paymentLink.id,
      amount:  plan.price,
      status:  'created',
      type:    'payment_link',
    },
  });

  res.json({
    paymentLinkId:  paymentLink.id,
    paymentLinkUrl: paymentLink.short_url,
    expiresAt:      paymentLink.expire_by ? new Date(paymentLink.expire_by * 1000) : null,
  });
});

// ── GET /api/subscription/admin/payment-history ───────────────────────────────
router.get('/admin/payment-history', authenticate, requireAdmin, async (_req, res) => {
  const payments = await prisma.payment.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      plan: { select: { name: true, price: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(payments);
});

// ── POST /api/subscription/webhook ───────────────────────────────────────────
// Razorpay sends webhooks when payment is captured or payment link is paid
router.post('/webhook', async (req, res) => {
  const signature  = req.headers['x-razorpay-signature'] as string;
  const secret     = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';

  // Verify webhook signature if secret is configured
  if (secret) {
    const expected = crypto.createHmac('sha256', secret)
      .update(JSON.stringify(req.body)).digest('hex');
    if (expected !== signature) {
      res.status(400).json({ error: 'Invalid webhook signature' });
      return;
    }
  }

  const event   = req.body.event as string;
  const payload = req.body.payload;

  if (event === 'payment.captured') {
    const payment = payload.payment?.entity;
    const { userId, planId } = payment?.notes ?? {};
    if (userId && planId) {
      await activateSubscription(userId, planId);
      await prisma.payment.updateMany({
        where: { razorpayOrderId: payment.order_id },
        data:  { razorpayPaymentId: payment.id, status: 'paid' },
      });
    }
  }

  if (event === 'payment_link.paid') {
    const link  = payload.payment_link?.entity;
    const pmt   = payload.payment?.entity;
    const { userId, planId } = link?.notes ?? {};
    if (userId && planId) {
      await activateSubscription(userId, planId);
      await prisma.payment.updateMany({
        where: { razorpayPaymentLinkId: link.id },
        data:  { razorpayPaymentId: pmt?.id ?? null, status: 'paid' },
      });
    }
  }

  res.json({ status: 'ok' });
});

// ── Feature-gate check (used by other routes) ─────────────────────────────────
export { getUserFeatures };
export default router;
