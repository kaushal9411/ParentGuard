'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  CreditCard, Plus, Edit2, Trash2, Users, Check, X,
  BadgeCheck, Clock, AlertCircle, ChevronDown, ChevronUp,
  Send, Link, IndianRupee, CheckCircle,
} from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import PageLoader from '@/components/PageLoader';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Features {
  maxDevices: number; location: boolean; notifications: boolean;
  callLogs: boolean; contacts: boolean; appUsage: boolean;
  gallery: boolean; browsingHistory: boolean; geofencing: boolean;
  appBlocking: boolean; remoteCommands: boolean; historyDays: number;
}

interface Plan {
  id: string; name: string; description: string | null;
  price: number; durationDays: number; sortOrder: number;
  isActive: boolean; features: Features;
  _count?: { subscriptions: number };
}

interface UserSub {
  id: string; name: string; email: string; role: string;
  subscription: {
    id: string; status: string; startedAt: string; expiresAt: string | null;
    plan: { id: string; name: string; price: number };
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FEATURE_LABELS: [keyof Features, string][] = [
  ['location',        'Location Tracking'],
  ['notifications',   'Notifications'],
  ['callLogs',        'Call Logs'],
  ['contacts',        'Contacts'],
  ['appUsage',        'App Usage'],
  ['gallery',         'Gallery & Media'],
  ['browsingHistory', 'Browsing History'],
  ['geofencing',      'Geofencing'],
  ['appBlocking',     'App Blocking'],
  ['remoteCommands',  'Remote Commands'],
];

const PLAN_COLORS: Record<string, string> = {
  Free:     'from-gray-700 to-gray-800 border-gray-600',
  Basic:    'from-blue-900 to-blue-950 border-blue-700',
  Standard: 'from-indigo-900 to-indigo-950 border-indigo-700',
  Premium:  'from-purple-900 to-purple-950 border-purple-700',
};

function planColor(name: string) {
  return PLAN_COLORS[name] ?? 'from-gray-800 to-gray-900 border-gray-700';
}

function fmtDate(s: string | null) {
  if (!s) return 'No expiry';
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusBadge(status: string) {
  if (status === 'active')    return <span className="text-green-400 bg-green-900/30 text-xs px-2 py-0.5 rounded-full font-semibold">Active</span>;
  if (status === 'expired')   return <span className="text-red-400 bg-red-900/30 text-xs px-2 py-0.5 rounded-full font-semibold">Expired</span>;
  if (status === 'cancelled') return <span className="text-gray-400 bg-gray-800 text-xs px-2 py-0.5 rounded-full font-semibold">Cancelled</span>;
  return <span className="text-yellow-400 bg-yellow-900/30 text-xs px-2 py-0.5 rounded-full font-semibold">None</span>;
}

// ─── Default features ─────────────────────────────────────────────────────────
const DEFAULT_FEATURES: Features = {
  maxDevices: 1, location: true, notifications: true, callLogs: false,
  contacts: false, appUsage: false, gallery: false, browsingHistory: false,
  geofencing: false, appBlocking: false, remoteCommands: false, historyDays: 30,
};

// ─── Plan form modal ──────────────────────────────────────────────────────────
function PlanModal({ plan, onSave, onClose }: {
  plan: Plan | null; onSave: () => void; onClose: () => void;
}) {
  const isEdit = !!plan;
  const [name, setName]         = useState(plan?.name ?? '');
  const [desc, setDesc]         = useState(plan?.description ?? '');
  const [price, setPrice]       = useState(String(plan?.price ?? 0));
  const [days, setDays]         = useState(String(plan?.durationDays ?? 30));
  const [order, setOrder]       = useState(String(plan?.sortOrder ?? 0));
  const [active, setActive]     = useState(plan?.isActive ?? true);
  const [features, setFeatures] = useState<Features>(plan?.features ?? DEFAULT_FEATURES);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const toggleFeature = (key: keyof Features) => {
    if (typeof features[key] === 'boolean') {
      setFeatures((f) => ({ ...f, [key]: !f[key] }));
    }
  };

  async function save() {
    setSaving(true); setError('');
    try {
      const data = {
        name, description: desc || undefined,
        price: parseFloat(price), durationDays: parseInt(days),
        sortOrder: parseInt(order), isActive: active, features,
      };
      if (isEdit) await adminApi.updatePlan(plan!.id, data);
      else        await adminApi.createPlan(data);
      onSave();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error;
      setError(typeof msg === 'string' ? msg : 'Save failed');
    } finally { setSaving(false); }
  }

  const inp = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-bold text-lg">{isEdit ? 'Edit Plan' : 'New Plan'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && <p className="text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-gray-400 text-xs mb-1 block">Plan Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Premium" className={inp} />
            </div>
            <div className="col-span-2">
              <label className="text-gray-400 text-xs mb-1 block">Description</label>
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description" className={inp} />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Price (₹/month)</label>
              <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" step="0.01" className={inp} />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Duration (days)</label>
              <input value={days} onChange={(e) => setDays(e.target.value)} type="number" min="1" className={inp} />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Max Devices</label>
              <input value={features.maxDevices} onChange={(e) => setFeatures((f) => ({ ...f, maxDevices: parseInt(e.target.value) || 1 }))} type="number" min="1" className={inp} />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">History Retention (days)</label>
              <input value={features.historyDays} onChange={(e) => setFeatures((f) => ({ ...f, historyDays: parseInt(e.target.value) || 7 }))} type="number" min="1" className={inp} />
            </div>
          </div>

          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Included Features</p>
            <div className="grid grid-cols-2 gap-2">
              {FEATURE_LABELS.map(([key, label]) => (
                <button key={key} onClick={() => toggleFeature(key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors border ${
                    features[key] ? 'bg-indigo-600/20 border-indigo-700 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                  <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${features[key] ? 'bg-indigo-500' : 'bg-gray-600'}`}>
                    {features[key] && <Check size={10} className="text-white" />}
                  </div>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setActive((a) => !a)}
              className={`w-10 h-5 rounded-full transition-colors ${active ? 'bg-green-500' : 'bg-gray-600'}`}>
              <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-0.5 ${active ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <span className="text-sm text-gray-400">{active ? 'Active — visible to users' : 'Inactive — hidden from users'}</span>
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-800">
          <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">Cancel</button>
          <button onClick={save} disabled={saving || !name}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
            {saving ? 'Saving…' : isEdit ? 'Update Plan' : 'Create Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Assign subscription modal ────────────────────────────────────────────────
function AssignModal({ user, plans, onSave, onClose }: {
  user: UserSub; plans: Plan[]; onSave: () => void; onClose: () => void;
}) {
  const [planId, setPlanId]     = useState(user.subscription?.plan.id ?? plans[0]?.id ?? '');
  const [expiry, setExpiry]     = useState('');
  const [notes, setNotes]       = useState(user.subscription ? '' : '');
  const [saving, setSaving]     = useState(false);

  async function save() {
    setSaving(true);
    try {
      await adminApi.assignSubscription(user.id, {
        planId,
        expiresAt: expiry || null,
        notes: notes || undefined,
      });
      onSave();
    } finally { setSaving(false); }
  }

  const inp = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-white font-bold">Assign Subscription</h2>
            <p className="text-gray-500 text-sm">{user.name} · {user.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Plan</label>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={inp}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — ₹{p.price}/month</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Expiry Date (leave blank = plan duration)</label>
            <input value={expiry} onChange={(e) => setExpiry(e.target.value)} type="datetime-local" className={inp} />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Notes (optional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Manual activation for trial" className={inp} />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-gray-800">
          <button onClick={onClose} className="flex-1 bg-gray-800 text-white text-sm font-semibold py-2.5 rounded-xl">Cancel</button>
          <button onClick={save} disabled={saving || !planId}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl">
            {saving ? 'Saving…' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Send Payment Link Modal ──────────────────────────────────────────────────
function SendPaymentLinkModal({ user, plans, onClose }: {
  user: UserSub; plans: Plan[]; onClose: () => void;
}) {
  const [planId, setPlanId]   = useState(plans.find(p => p.price > 0)?.id ?? '');
  const [phone, setPhone]     = useState('');
  const [note, setNote]       = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult]   = useState<{ url: string; expiresAt: string | null } | null>(null);
  const [error, setError]     = useState('');

  const inp = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500';

  async function send() {
    setSending(true); setError('');
    try {
      const res = await adminApi.sendPaymentLink(user.id, { planId, phone: phone || undefined, description: note || undefined });
      setResult({ url: res.data.paymentLinkUrl, expiresAt: res.data.expiresAt });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to create payment link';
      setError(msg);
    } finally { setSending(false); }
  }

  const selectedPlan = plans.find(p => p.id === planId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-white font-bold flex items-center gap-2"><Link size={16} className="text-indigo-400" /> Send Payment Link</h2>
            <p className="text-gray-500 text-sm mt-0.5">{user.name} · {user.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>

        {result ? (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-green-400 font-semibold">
              <CheckCircle size={18} /> Payment link created and sent!
            </div>
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-gray-400 text-xs mb-1">Share this link with the user:</p>
              <p className="text-indigo-400 text-sm break-all">{result.url}</p>
            </div>
            {result.expiresAt && (
              <p className="text-gray-500 text-xs">Link expires: {new Date(result.expiresAt).toLocaleString()}</p>
            )}
            <p className="text-gray-400 text-xs">
              ✓ Email sent to {user.email}
              {phone && ` · SMS sent to ${phone}`}
            </p>
            <button onClick={onClose} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors">Done</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {error && <p className="text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Plan</label>
              <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={inp}>
                {plans.filter(p => p.price > 0).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — ₹{p.price}/month</option>
                ))}
              </select>
              {selectedPlan && <p className="text-gray-500 text-xs mt-1">Duration: {selectedPlan.durationDays} days · Amount: ₹{selectedPlan.price}</p>}
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Mobile Number (for SMS, optional)</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9876543210" className={inp} type="tel" />
              <p className="text-gray-600 text-xs mt-1">Razorpay will send SMS + Email automatically</p>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Link Description (optional)</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. ParentGuard Premium Subscription" className={inp} />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">Cancel</button>
              <button onClick={send} disabled={sending || !planId}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                {sending ? <><span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Sending…</> : <><Send size={13} /> Send Link</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SubscriptionsPage() {
  const [tab, setTab]               = useState<'plans' | 'users' | 'requests'>('plans');
  const [plans, setPlans]           = useState<Plan[]>([]);
  const [users, setUsers]           = useState<UserSub[]>([]);
  const [loading, setLoading]       = useState(true);
  const [editingPlan, setEditingPlan]     = useState<Plan | null | 'new'>(null);
  const [assignUser, setAssignUser]       = useState<UserSub | null>(null);
  const [payLinkUser, setPayLinkUser]     = useState<UserSub | null>(null);
  const [requests, setRequests]           = useState<Array<{ id: string; status: string; createdAt: string; user: { id: string; name: string; email: string }; plan: { id: string; name: string; price: number } }>>([]);
  const [search, setSearch]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, u, r] = await Promise.all([
        adminApi.getPlans(),
        adminApi.getSubscriptionUsers(),
        adminApi.getUpgradeRequests().catch(() => ({ data: [] })),
      ]);
      setPlans(p.data);
      setUsers(u.data);
      setRequests(r.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deletePlan(id: string, name: string) {
    if (!confirm(`Delete plan "${name}"? This cannot be undone.`)) return;
    try {
      await adminApi.deletePlan(id);
      setPlans((ps) => ps.filter((p) => p.id !== id));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error;
      alert(typeof msg === 'string' ? msg : 'Failed to delete');
    }
  }

  async function revokeSubscription(userId: string, name: string) {
    if (!confirm(`Revoke subscription for "${name}"?`)) return;
    await adminApi.revokeSubscription(userId);
    await load();
  }

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const activeCount    = users.filter((u) => u.subscription?.status === 'active').length;
  const noSubCount     = users.filter((u) => !u.subscription || u.subscription.status !== 'active').length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-8 pt-8 pb-0 border-b border-gray-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
              <CreditCard size={24} className="text-indigo-400" /> Subscriptions
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">Manage plans and user subscriptions</p>
          </div>
          {tab === 'plans' && (
            <button onClick={() => setEditingPlan('new')}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <Plus size={15} /> New Plan
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="flex gap-6 text-sm pb-4">
          <span className="text-gray-400"><span className="text-white font-bold">{plans.filter(p=>p.isActive).length}</span> active plans</span>
          <span className="text-gray-400"><span className="text-green-400 font-bold">{activeCount}</span> subscribed users</span>
          <span className="text-gray-400"><span className="text-yellow-400 font-bold">{noSubCount}</span> on free/none</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {([
            ['plans', `Plans (${plans.length})`],
            ['users', `Users (${users.length})`],
            ['requests', `Upgrade Requests ${requests.filter(r => r.status === 'pending').length > 0 ? `(${requests.filter(r => r.status === 'pending').length} pending)` : `(${requests.length})`}`],
          ] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t as 'plans' | 'users')}
              className={`px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {loading ? (
          <PageLoader theme="dark" />
        ) : tab === 'plans' ? (

          /* ── Plans grid ── */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {plans.map((plan) => (
              <div key={plan.id} className={`bg-gradient-to-br ${planColor(plan.name)} border rounded-2xl overflow-hidden flex flex-col`}>
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-white font-extrabold text-lg">{plan.name}</h3>
                      {plan.description && <p className="text-gray-400 text-xs mt-0.5">{plan.description}</p>}
                    </div>
                    {!plan.isActive && <span className="text-gray-500 text-xs bg-gray-800 px-2 py-0.5 rounded-full">Inactive</span>}
                  </div>

                  <div className="mb-4">
                    <span className="text-3xl font-extrabold text-white">
                      {plan.price === 0 ? 'Free' : `₹${plan.price}`}
                    </span>
                    {plan.price > 0 && <span className="text-gray-400 text-sm">/month</span>}
                  </div>

                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-2 text-xs text-gray-300">
                      <Check size={11} className="text-green-400 flex-shrink-0" />
                      <span>{plan.features.maxDevices} device{plan.features.maxDevices !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-300">
                      <Check size={11} className="text-green-400 flex-shrink-0" />
                      <span>{plan.features.historyDays} days history</span>
                    </div>
                    {FEATURE_LABELS.map(([key, label]) => (
                      <div key={key} className={`flex items-center gap-2 text-xs ${plan.features[key] ? 'text-gray-300' : 'text-gray-600 line-through'}`}>
                        {plan.features[key]
                          ? <Check size={11} className="text-green-400 flex-shrink-0" />
                          : <X size={11} className="text-gray-600 flex-shrink-0" />}
                        {label}
                      </div>
                    ))}
                  </div>

                  {plan._count && (
                    <p className="text-gray-500 text-xs">{plan._count.subscriptions} subscriber{plan._count.subscriptions !== 1 ? 's' : ''}</p>
                  )}
                </div>

                <div className="flex gap-2 p-3 border-t border-white/10">
                  <button onClick={() => setEditingPlan(plan)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs text-gray-300 hover:text-white bg-white/10 hover:bg-white/20 py-1.5 rounded-lg transition-colors">
                    <Edit2 size={11} /> Edit
                  </button>
                  <button onClick={() => deletePlan(plan.id, plan.name)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/40 py-1.5 rounded-lg transition-colors">
                    <Trash2 size={11} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

        ) : tab === 'users' ? (

          /* ── Users + subscriptions ── */
          <div>
            <div className="relative mb-4 max-w-xs">
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users…"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-3 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs">
                    <th className="text-left px-5 py-3">User</th>
                    <th className="text-left px-5 py-3">Current Plan</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Expires</th>
                    <th className="text-left px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-indigo-700/40 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-white font-semibold text-sm">{u.name}</p>
                            <p className="text-gray-500 text-xs">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-white font-semibold">{u.subscription?.plan.name ?? '—'}</span>
                        {u.subscription?.plan.price != null && u.subscription.plan.price > 0 && (
                          <span className="text-gray-500 text-xs ml-1">₹{u.subscription.plan.price}/mo</span>
                        )}
                      </td>
                      <td className="px-5 py-3">{statusBadge(u.subscription?.status ?? 'none')}</td>
                      <td className="px-5 py-3 text-gray-400 text-xs">
                        {u.subscription?.expiresAt ? fmtDate(u.subscription.expiresAt) : u.subscription ? 'No expiry' : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button onClick={() => setAssignUser(u)}
                            className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-900/20 hover:bg-indigo-900/40 px-2.5 py-1 rounded-lg transition-colors">
                            {u.subscription?.status === 'active' ? 'Change' : 'Assign'}
                          </button>
                          <button onClick={() => setPayLinkUser(u)}
                            className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 bg-green-900/20 hover:bg-green-900/40 px-2.5 py-1 rounded-lg transition-colors">
                            <Send size={10} /> Pay Link
                          </button>
                          {u.subscription?.status === 'active' && (
                            <button onClick={() => revokeSubscription(u.id, u.name)}
                              className="text-xs text-red-400 hover:text-red-300 bg-red-900/20 px-2.5 py-1 rounded-lg transition-colors">
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-gray-500 py-12">No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === 'requests' ? (

          /* ── Upgrade requests ── */
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {requests.length === 0 ? (
              <div className="text-center text-gray-500 py-12">No upgrade requests yet</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs">
                    <th className="text-left px-5 py-3">User</th>
                    <th className="text-left px-5 py-3">Requested Plan</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Submitted</th>
                    <th className="text-left px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {requests.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-800/30">
                      <td className="px-5 py-3">
                        <p className="text-white font-semibold text-sm">{r.user.name}</p>
                        <p className="text-gray-500 text-xs">{r.user.email}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-white font-semibold">{r.plan.name}</span>
                        <span className="text-gray-500 text-xs ml-1">₹{r.plan.price}/mo</span>
                      </td>
                      <td className="px-5 py-3">{statusBadge(r.status)}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{fmtDate(r.createdAt)}</td>
                      <td className="px-5 py-3">
                        {r.status === 'pending' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => { await adminApi.processRequest(r.id, 'approve'); load(); }}
                              className="flex items-center gap-1 text-xs text-green-400 bg-green-900/20 hover:bg-green-900/40 px-2.5 py-1 rounded-lg transition-colors">
                              <Check size={11} /> Approve
                            </button>
                            <button
                              onClick={async () => {
                                const user = users.find(u => u.id === r.user.id);
                                if (user) setPayLinkUser(user);
                              }}
                              className="flex items-center gap-1 text-xs text-blue-400 bg-blue-900/20 hover:bg-blue-900/40 px-2.5 py-1 rounded-lg transition-colors">
                              <Send size={11} /> Send Payment
                            </button>
                            <button
                              onClick={async () => { await adminApi.processRequest(r.id, 'reject'); load(); }}
                              className="flex items-center gap-1 text-xs text-red-400 bg-red-900/20 hover:bg-red-900/40 px-2.5 py-1 rounded-lg transition-colors">
                              <X size={11} /> Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        ) : null}
      </div>

      {/* Modals */}
      {editingPlan !== null && (
        <PlanModal
          plan={editingPlan === 'new' ? null : editingPlan}
          onSave={() => { setEditingPlan(null); load(); }}
          onClose={() => setEditingPlan(null)}
        />
      )}
      {assignUser && (
        <AssignModal
          user={assignUser}
          plans={plans.filter((p) => p.isActive)}
          onSave={() => { setAssignUser(null); load(); }}
          onClose={() => setAssignUser(null)}
        />
      )}
      {payLinkUser && (
        <SendPaymentLinkModal
          user={payLinkUser}
          plans={plans.filter((p) => p.isActive && p.price > 0)}
          onClose={() => setPayLinkUser(null)}
        />
      )}
    </div>
  );
}
