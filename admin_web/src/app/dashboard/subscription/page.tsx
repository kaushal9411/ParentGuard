'use client';
import { useEffect, useState, useCallback } from 'react';
import Script from 'next/script';
import axios from 'axios';
import {
  CreditCard, Check, X, Zap, Clock, Star,
  AlertCircle, CheckCircle, ArrowRight, Loader,
  Receipt, IndianRupee,
} from 'lucide-react';
import Header from '@/components/Header';
import PageLoader from '@/components/PageLoader';
import { getToken } from '@/lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Features {
  maxDevices: number; location: boolean; notifications: boolean;
  callLogs: boolean; smsLogs: boolean; contacts: boolean; appUsage: boolean;
  gallery: boolean; browsingHistory: boolean; geofencing: boolean;
  appBlocking: boolean; remoteCommands: boolean; historyDays: number;
}
interface Plan {
  id: string; name: string; description: string | null;
  price: number; durationDays: number; features: Features;
}
interface CurrentSub {
  plan: Plan | null; status: string;
  startedAt: string | null; expiresAt: string | null; features: Features;
}
interface PendingRequest { id: string; planId: string; status: string; createdAt: string; }
interface PaymentRecord {
  id: string; amount: number; status: string; type: string;
  createdAt: string; plan: { name: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const RZP_KEY = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? 'rzp_test_SrD9RqGOrFNN3c';

const FEATURE_LIST: [keyof Features, string, string][] = [
  ['location',        'Location Tracking',   'Real-time GPS tracking'],
  ['notifications',   'Notifications',       'App notification monitoring'],
  ['callLogs',        'Call Logs',           'Incoming & outgoing call history'],
  ['smsLogs',         'SMS Messages',        'Read sent and received text messages'],
  ['contacts',        'Contacts Sync',       'Device contact list backup'],
  ['appUsage',        'App Usage Stats',     'Time spent per application'],
  ['gallery',         'Gallery & Media',     'Photos and video monitoring'],
  ['browsingHistory', 'Browsing History',    'Browser URL history'],
  ['geofencing',      'Geofencing',          'Location-based zone alerts'],
  ['appBlocking',     'App Blocking',        'Remotely block applications'],
  ['remoteCommands',  'Remote Commands',     'Capture photos and recordings'],
];

const PLAN_STYLES: Record<string, { border: string; badge: string; btn: string; highlight: string }> = {
  Free:     { border: 'border-gray-200',   badge: 'bg-gray-100 text-gray-600',    btn: 'bg-gray-800 hover:bg-gray-700 text-white',    highlight: '' },
  Basic:    { border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700',    btn: 'bg-blue-600 hover:bg-blue-700 text-white',    highlight: '' },
  Standard: { border: 'border-indigo-300', badge: 'bg-indigo-100 text-indigo-700',btn: 'bg-indigo-600 hover:bg-indigo-700 text-white',highlight: 'ring-2 ring-indigo-400 ring-offset-2' },
  Premium:  { border: 'border-purple-300', badge: 'bg-purple-100 text-purple-700',btn: 'bg-purple-600 hover:bg-purple-700 text-white', highlight: '' },
};
function ps(name: string) { return PLAN_STYLES[name] ?? PLAN_STYLES['Basic']; }
function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function daysLeft(s: string): number {
  return Math.max(0, Math.ceil((new Date(s).getTime() - Date.now()) / 86_400_000));
}

// ─── Razorpay checkout helper ─────────────────────────────────────────────────

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

function openRazorpayCheckout(opts: {
  orderId: string; amount: number; currency: string;
  planName: string; userName: string; userEmail: string;
  onSuccess: (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  onDismiss: () => void;
}) {
  const rzp = new window.Razorpay({
    key:         RZP_KEY,
    order_id:    opts.orderId,
    amount:      opts.amount,
    currency:    opts.currency,
    name:        'ParentGuard',
    description: `${opts.planName} Plan Subscription`,
    image:       '/icon.png',
    prefill: { name: opts.userName, email: opts.userEmail },
    theme: { color: '#6366F1' },
    handler: opts.onSuccess,
    modal: { ondismiss: opts.onDismiss },
  });
  rzp.open();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const [sub, setSub]               = useState<CurrentSub | null>(null);
  const [plans, setPlans]           = useState<Plan[]>([]);
  const [pending, setPending]       = useState<PendingRequest | null>(null);
  const [payments, setPayments]     = useState<PaymentRecord[]>([]);
  const [loading, setLoading]       = useState(true);
  const [payLoading, setPayLoading] = useState<string | null>(null); // planId being paid
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const api = useCallback(() => axios.create({
    baseURL: API,
    headers: { Authorization: `Bearer ${getToken()}` },
  }), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, plansRes, histRes] = await Promise.all([
        api().get('/api/subscription/my'),
        api().get('/api/subscription/plans'),
        api().get('/api/subscription/payment-history').catch(() => ({ data: [] })),
      ]);
      setSub(subRes.data);
      setPlans(plansRes.data);
      setPayments(histRes.data);

      try {
        const reqRes = await api().get('/api/subscription/my-request');
        setPending(reqRes.data);
      } catch { setPending(null); }
    } finally { setLoading(false); }
  }, [api]);

  useEffect(() => {
    load();
    // Check payment success redirect from Razorpay
    const url = new URL(window.location.href);
    if (url.searchParams.get('payment') === 'success') {
      showToast('Payment successful! Your subscription has been activated.', true);
      window.history.replaceState({}, '', '/dashboard/subscription');
    }
  }, [load]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  }

  async function handlePayment(plan: Plan) {
    if (plan.price === 0) return;
    setPayLoading(plan.id);
    try {
      // 1. Create order on backend
      const { data } = await api().post('/api/subscription/create-order', { planId: plan.id });

      // 2. Open Razorpay checkout
      openRazorpayCheckout({
        orderId:   data.orderId,
        amount:    data.amount,
        currency:  data.currency,
        planName:  data.planName,
        userName:  data.userName,
        userEmail: data.userEmail,
        onSuccess: async (resp) => {
          try {
            // 3. Verify payment on backend
            await api().post('/api/subscription/verify-payment', resp);
            showToast(`🎉 ${plan.name} plan activated! Enjoy your subscription.`, true);
            await load();
          } catch {
            showToast('Payment received but verification failed. Please contact support.', false);
          }
        },
        onDismiss: () => {
          setPayLoading(null);
          showToast('Payment cancelled.', false);
        },
      });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to initiate payment';
      showToast(msg, false);
    } finally {
      setPayLoading(null);
    }
  }

  const currentPlanId = sub?.plan?.id ?? null;

  if (loading) {
    return (
      <>
        <Header title="Subscription" subtitle="Manage your plan" />
        <main className="flex-1">
          <PageLoader />
        </main>
      </>
    );
  }

  return (
    <>
      {/* Load Razorpay checkout script */}
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <Header title="Subscription" subtitle="Manage your plan and payments" />

      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-white text-sm font-semibold max-w-sm transition-all ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <main className="flex-1 p-8 space-y-8">

        {/* ── Current plan ── */}
        {sub && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Star size={18} className="text-yellow-500" /> Your Current Plan
            </h2>
            <div className={`card border-2 ${sub.plan ? ps(sub.plan.name).border : 'border-gray-200'} bg-gradient-to-br from-white to-gray-50`}>
              <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${sub.plan ? ps(sub.plan.name).badge : 'bg-gray-100 text-gray-600'}`}>
                      {sub.plan?.name ?? 'Free'}
                    </span>
                    {sub.status === 'active' && sub.plan
                      ? <span className="flex items-center gap-1 text-green-600 text-xs font-semibold bg-green-50 px-2 py-0.5 rounded-full border border-green-200"><CheckCircle size={11} /> Active</span>
                      : <span className="flex items-center gap-1 text-orange-600 text-xs font-semibold bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200"><AlertCircle size={11} /> {sub.status === 'expired' ? 'Expired' : 'Free Plan'}</span>}
                  </div>
                  <h2 className="text-3xl font-extrabold text-gray-900">
                    {!sub.plan || sub.plan.price === 0 ? 'Free' : `₹${sub.plan.price}`}
                    {sub.plan && sub.plan.price > 0 && <span className="text-sm font-normal text-gray-400">/month</span>}
                  </h2>
                  {sub.plan?.description && <p className="text-gray-500 text-sm mt-1">{sub.plan.description}</p>}
                </div>
                <div className="text-right space-y-1.5">
                  {sub.startedAt && (
                    <p className="text-xs text-gray-500">Started: <span className="font-medium text-gray-700">{fmtDate(sub.startedAt)}</span></p>
                  )}
                  {sub.expiresAt ? (
                    <div>
                      {daysLeft(sub.expiresAt) <= 7 ? (
                        <p className="text-red-600 font-bold text-sm">⚠ Expires in {daysLeft(sub.expiresAt)} day{daysLeft(sub.expiresAt) !== 1 ? 's' : ''}</p>
                      ) : (
                        <p className="text-xs text-gray-500">Expires: <span className="font-medium text-gray-700">{fmtDate(sub.expiresAt)}</span></p>
                      )}
                    </div>
                  ) : sub.status === 'active' && (
                    <p className="text-xs text-green-600 font-medium">✓ No expiry</p>
                  )}
                  {sub.plan && sub.plan.price > 0 && (
                    <p className="text-xs text-gray-400">{sub.features.maxDevices} device{sub.features.maxDevices !== 1 ? 's' : ''} · {sub.features.historyDays} days history</p>
                  )}
                </div>
              </div>

              {/* Included features */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {FEATURE_LIST.map(([key, label]) => {
                  const on = sub.features[key] as boolean;
                  return (
                    <div key={key} className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg ${on ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-300'}`}>
                      {on ? <Check size={11} className="flex-shrink-0" /> : <X size={11} className="flex-shrink-0" />}
                      <span className={on ? '' : 'line-through'}>{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Pending request / approval status ── */}
        {pending?.status === 'pending' && (
          <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-2xl px-5 py-4">
            <Clock size={18} className="text-yellow-500 flex-shrink-0" />
            <div>
              <p className="text-yellow-800 font-semibold text-sm">Upgrade Request Pending</p>
              <p className="text-yellow-600 text-xs mt-0.5">Submitted {fmtDate(pending.createdAt)} · Awaiting administrator approval</p>
            </div>
          </div>
        )}
        {pending?.status === 'approved' && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-5 py-4">
            <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
            <p className="text-green-800 font-semibold text-sm">Your upgrade request was approved and your plan has been updated!</p>
          </div>
        )}
        {pending?.status === 'rejected' && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
            <p className="text-red-800 font-semibold text-sm">Your upgrade request was declined. Contact your administrator for more information.</p>
          </div>
        )}

        {/* ── Plans grid ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <CreditCard size={18} className="text-indigo-600" /> Choose a Plan
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {plans.map((plan) => {
              const isCurrent  = plan.id === currentPlanId;
              const style      = ps(plan.name);
              const isLoading  = payLoading === plan.id;

              return (
                <div key={plan.id} className={`card border-2 flex flex-col transition-all ${isCurrent ? `${style.border} ${style.highlight}` : 'border-gray-200 hover:border-gray-300 hover:shadow-md'}`}>
                  {isCurrent && (
                    <div className="bg-indigo-600 text-white text-[11px] font-bold px-3 py-1 rounded-t-xl text-center -mx-5 -mt-5 mb-4">
                      ✓ YOUR CURRENT PLAN
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-xl font-extrabold text-gray-900">{plan.name}</h3>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
                      {plan.price === 0 ? 'Free' : `₹${plan.price}/mo`}
                    </span>
                  </div>
                  {plan.description && <p className="text-gray-400 text-xs mb-3">{plan.description}</p>}

                  <div className="text-4xl font-extrabold text-gray-900 mb-4">
                    {plan.price === 0 ? '₹0' : `₹${plan.price}`}
                    {plan.price > 0 && <span className="text-sm font-normal text-gray-400">/month</span>}
                  </div>

                  <ul className="space-y-2 flex-1 mb-6 text-sm">
                    <li className="flex items-center gap-2 text-gray-700 font-medium">
                      <Check size={13} className="text-green-500 flex-shrink-0" />
                      {plan.features.maxDevices} device{plan.features.maxDevices !== 1 ? 's' : ''}
                    </li>
                    <li className="flex items-center gap-2 text-gray-700">
                      <Check size={13} className="text-green-500 flex-shrink-0" />
                      {plan.features.historyDays} days data history
                    </li>
                    {FEATURE_LIST.map(([key, label]) => {
                      const on = plan.features[key] as boolean;
                      return (
                        <li key={key} className={`flex items-center gap-2 text-sm ${on ? 'text-gray-700' : 'text-gray-300'}`}>
                          {on ? <Check size={13} className="text-green-500 flex-shrink-0" /> : <X size={13} className="text-gray-300 flex-shrink-0" />}
                          <span className={on ? '' : 'line-through'}>{label}</span>
                        </li>
                      );
                    })}
                  </ul>

                  {/* CTA button */}
                  {isCurrent ? (
                    <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 text-sm font-semibold">
                      <CheckCircle size={14} /> Current Plan
                    </div>
                  ) : plan.price === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-100 text-gray-400 text-sm font-semibold cursor-default">
                      Contact admin to downgrade
                    </div>
                  ) : (
                    <button
                      onClick={() => handlePayment(plan)}
                      disabled={!!payLoading}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-60 ${style.btn} shadow-sm hover:shadow-md`}
                    >
                      {isLoading ? (
                        <><Loader size={14} className="animate-spin" /> Processing…</>
                      ) : (
                        <><IndianRupee size={13} /> Pay ₹{plan.price} &amp; Subscribe</>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Feature comparison table ── */}
        <div className="card overflow-hidden">
          <h3 className="font-bold text-gray-900 text-lg mb-5">Full Feature Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="text-left pb-3 pr-4 font-semibold">Feature</th>
                  {plans.map((p) => (
                    <th key={p.id} className={`pb-3 px-4 font-bold text-center ${p.id === currentPlanId ? 'text-indigo-600' : 'text-gray-700'}`}>
                      {p.name}
                      {p.id === currentPlanId && <span className="block text-[10px] text-indigo-400 normal-case font-normal">current</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <tr className="hover:bg-gray-50">
                  <td className="py-2.5 pr-4 text-gray-700 font-medium">Max Devices</td>
                  {plans.map((p) => <td key={p.id} className="py-2.5 px-4 text-center font-bold text-gray-800">{p.features.maxDevices}</td>)}
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="py-2.5 pr-4 text-gray-700 font-medium">History Retention</td>
                  {plans.map((p) => <td key={p.id} className="py-2.5 px-4 text-center text-gray-600">{p.features.historyDays} days</td>)}
                </tr>
                {FEATURE_LIST.map(([key, label, desc]) => (
                  <tr key={key} className="hover:bg-gray-50">
                    <td className="py-2.5 pr-4">
                      <p className="text-gray-700 font-medium">{label}</p>
                      <p className="text-gray-400 text-xs">{desc}</p>
                    </td>
                    {plans.map((p) => (
                      <td key={p.id} className="py-2.5 px-4 text-center">
                        {(p.features[key] as boolean)
                          ? <Check size={16} className="text-green-500 mx-auto" />
                          : <X size={16} className="text-gray-200 mx-auto" />}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="py-3 pr-4 font-extrabold text-gray-900">Monthly Price</td>
                  {plans.map((p) => (
                    <td key={p.id} className={`py-3 px-4 text-center font-extrabold ${p.id === currentPlanId ? 'text-indigo-600' : 'text-gray-900'}`}>
                      {p.price === 0 ? 'Free' : `₹${p.price}`}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Payment history ── */}
        {payments.length > 0 && (
          <div className="card">
            <button onClick={() => setShowHistory((h) => !h)}
              className="w-full flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Receipt size={16} className="text-gray-500" /> Payment History ({payments.length})
              </h3>
              <span className="text-gray-400 text-xs">{showHistory ? '▲ Hide' : '▼ Show'}</span>
            </button>

            {showHistory && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 text-xs uppercase border-b border-gray-100">
                      <th className="pb-2 pr-4">Plan</th>
                      <th className="pb-2 pr-4">Amount</th>
                      <th className="pb-2 pr-4">Type</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="py-2.5 pr-4 font-medium text-gray-900">{p.plan.name}</td>
                        <td className="py-2.5 pr-4 text-gray-700 font-semibold">₹{p.amount}</td>
                        <td className="py-2.5 pr-4 text-gray-500 capitalize">{p.type.replace('_', ' ')}</td>
                        <td className="py-2.5 pr-4">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                            p.status === 'paid' ? 'bg-green-100 text-green-700' :
                            p.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-gray-400 text-xs">{fmtDate(p.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
