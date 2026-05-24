'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Smartphone, MapPin, Bell, Phone, MessageSquare, Globe,
  Wifi, WifiOff, Clock, TrendingUp, TrendingDown, Camera,
  Shield, Activity, Users, Eye, Zap, ChevronRight, BarChart2,
  PhoneIncoming, PhoneOutgoing, PhoneMissed, Image as ImageIcon,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  devicesApi, locationApi, usageApi, notificationsApi,
  userCallsApi, userSmsApi, userBrowsingApi, userGalleryApi,
} from '@/lib/api';
import type { Device, LocationLog, NotificationLog } from '@/types';
import { getUser } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

// ── Local types ───────────────────────────────────────────────────────────────
interface UsageLog   { id: string; appName: string; usageDurationMs: string; category: string | null; }
interface CallLog    { id: string; number: string; name: string | null; type: string; duration: number; timestamp: string; }
interface SmsItem    { id: string; address: string; body: string; type: number; date: string; }
interface BrowseItem { id: string; url: string; title: string | null; visitedAt: string; }
interface GalleryItem{ id: string; fileName: string; mimeType: string; thumbnail: string | null; imageUrl: string | null; takenAt: string | null; }

// ── Palette ───────────────────────────────────────────────────────────────────
const COLORS = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(d: string | null): string {
  if (!d) return 'Never';
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function msToHm(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
}
function getDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url.slice(0, 25); }
}
function isToday(dateStr: string): boolean {
  const d = new Date(dateStr); const n = new Date();
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, from, to, iconBg, trend }: {
  label: string; value: string | number; sub?: string; icon: React.ReactNode;
  from: string; to: string; iconBg: string; trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br ${from} ${to} shadow-sm border border-white/70`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">{label}</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1 leading-none">{value}</p>
          {sub && <p className="text-[11px] text-gray-500 mt-1.5 truncate">{sub}</p>}
        </div>
        <div className={`w-11 h-11 ${iconBg} rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0`}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1.5">
          {trend === 'up'      && <TrendingUp   size={11} className="text-green-500" />}
          {trend === 'down'    && <TrendingDown  size={11} className="text-red-400" />}
          {trend === 'neutral' && <Activity      size={11} className="text-gray-400" />}
          <span className={`text-[10px] font-semibold ${
            trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-gray-400'
          }`}>
            {trend === 'up' ? 'Active today' : trend === 'down' ? 'Needs attention' : 'No change'}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────
function SCard({ title, sub, icon, href, accent, children, noPad }: {
  title: string; sub?: string; icon: React.ReactNode; href?: string;
  accent?: string; children: React.ReactNode; noPad?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
      <div className={`flex items-center justify-between px-5 py-4 border-b border-gray-50 flex-shrink-0 ${accent ?? ''}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-gray-400 flex-shrink-0">{icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-none truncate">{title}</p>
            {sub && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{sub}</p>}
          </div>
        </div>
        {href && (
          <Link href={href} className="flex items-center gap-1 text-xs font-semibold text-primary hover:opacity-70 transition-opacity flex-shrink-0 ml-2">
            View all <ChevronRight size={12} />
          </Link>
        )}
      </div>
      <div className={`flex-1 ${noPad ? '' : 'p-5'}`}>{children}</div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function Empty({ icon, msg }: { icon: React.ReactNode; msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-300">
      <span className="opacity-30">{icon}</span>
      <p className="text-xs text-gray-400">{msg}</p>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Sk({ h = 'h-4', w = 'w-full', r = 'rounded-xl' }: { h?: string; w?: string; r?: string }) {
  return <div className={`${h} ${w} ${r} bg-gray-100 animate-pulse`} />;
}

// ── Custom tooltip for recharts ───────────────────────────────────────────────
function ChartTip({ active, payload, label }: { active?: boolean; payload?: {name:string;value:number;fill?:string}[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-xl px-3 py-2 text-xs">
      {label && <p className="font-semibold text-gray-500 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-bold" style={{ color: p.fill ?? '#6366f1' }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [parentName, setParentName] = useState('');
  const [devices,    setDevices]    = useState<Device[]>([]);
  const [selected,   setSelected]   = useState('');
  const [loading,    setLoading]    = useState(true);
  const [busy,       setBusy]       = useState(false);

  const [location,      setLocation]      = useState<LocationLog | null>(null);
  const [usage,         setUsage]         = useState<UsageLog[]>([]);
  const [calls,         setCalls]         = useState<CallLog[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [sms,           setSms]           = useState<SmsItem[]>([]);
  const [browsing,      setBrowsing]      = useState<BrowseItem[]>([]);
  const [gallery,       setGallery]       = useState<GalleryItem[]>([]);

  useEffect(() => {
    const u = getUser<{ name: string }>();
    setParentName(u?.name?.split(' ')[0] ?? 'Parent');
    devicesApi.list().then((r) => {
      const devs: Device[] = r.data ?? [];
      setDevices(devs);
      const child = devs.find((d) => d.role === 'child');
      if (child) setSelected(child.deviceId);
    }).finally(() => setLoading(false));
  }, []);

  const loadData = useCallback(async (deviceId: string) => {
    setBusy(true);
    const [l, u, c, n, s, b, g] = await Promise.allSettled([
      locationApi.history(deviceId, 1),
      usageApi.daily(deviceId),
      userCallsApi.list(deviceId, 200),
      notificationsApi.list(deviceId, 30),
      userSmsApi.list(deviceId, 30),
      userBrowsingApi.list(deviceId, 50),
      userGalleryApi.list(deviceId, undefined, 12),
    ]);
    if (l.status === 'fulfilled') setLocation(l.value.data?.[0] ?? null);
    if (u.status === 'fulfilled') setUsage(u.value.data ?? []);
    if (c.status === 'fulfilled') setCalls(c.value.data ?? []);
    if (n.status === 'fulfilled') setNotifications(n.value.data ?? []);
    if (s.status === 'fulfilled') setSms(s.value.data ?? []);
    if (b.status === 'fulfilled') setBrowsing(b.value.data ?? []);
    if (g.status === 'fulfilled') setGallery(g.value.data ?? []);
    setBusy(false);
  }, []);

  useEffect(() => { if (selected) loadData(selected); }, [selected, loadData]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const childDevs   = devices.filter((d) => d.role === 'child');
  const selDev      = devices.find((d) => d.deviceId === selected);
  const totalMs     = usage.reduce((s, u) => s + Number(u.usageDurationMs), 0);
  const topApps     = [...usage].sort((a, b) => Number(b.usageDurationMs) - Number(a.usageDurationMs)).slice(0, 6);
  const todayCalls  = calls.filter((c) => isToday(c.timestamp)).length;
  const incoming    = calls.filter((c) => c.type === 'incoming').length;
  const outgoing    = calls.filter((c) => c.type === 'outgoing').length;
  const missed      = calls.filter((c) => c.type === 'missed').length;
  const todaySms    = sms.filter((s) => isToday(s.date)).length;

  const pieData = topApps.map((u) => ({ name: u.appName, value: Math.max(1, Math.round(Number(u.usageDurationMs) / 60000)) }));

  const callChart = [
    { name: 'In',  value: incoming, fill: '#10b981' },
    { name: 'Out', value: outgoing, fill: '#6366f1' },
    { name: 'Mis', value: missed,   fill: '#ef4444' },
  ];

  const domainMap: Record<string, number> = {};
  browsing.forEach((b) => { const d = getDomain(b.url); domainMap[d] = (domainMap[d] ?? 0) + 1; });
  const topDomains = Object.entries(domainMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxVisits  = topDomains[0]?.[1] ?? 1;

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 p-8 space-y-6">
        <Sk h="h-20" r="rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Sk key={i} h="h-28" />)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => <Sk key={i} h="h-72" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-8 py-5 sticky top-0 z-10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <h1 className="text-xl font-extrabold text-gray-900 mt-0.5">
              {greeting()}, {parentName} 👋
            </h1>
          </div>

          {/* Device pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {childDevs.length === 0 ? (
              <Link href="/dashboard/devices"
                className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-primary/30
                  text-primary text-xs font-semibold hover:bg-primary/5 transition-colors">
                + Add child device
              </Link>
            ) : childDevs.map((d) => (
              <button key={d.deviceId} onClick={() => setSelected(d.deviceId)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border-2 transition-all duration-200
                  ${selected === d.deviceId
                    ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40 hover:text-primary'}`}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${d.isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-300'}`} />
                <Smartphone size={12} />
                {d.name}
                {d.isOnline && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold
                    ${selected === d.deviceId ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'}`}>
                    LIVE
                  </span>
                )}
              </button>
            ))}
            {busy && <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">

        {/* ── 6 Stat Cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard label="Screen Time"  value={busy ? '—' : msToHm(totalMs)}   sub="Today"
            icon={<Clock size={19} className="text-indigo-600" />}
            from="from-indigo-50" to="to-purple-50" iconBg="bg-indigo-100"
            trend={totalMs > 14400000 ? 'up' : totalMs > 0 ? 'neutral' : 'down'} />

          <StatCard label="Apps Used"    value={busy ? '—' : usage.length}       sub={topApps[0]?.appName ?? 'Today'}
            icon={<BarChart2 size={19} className="text-purple-600" />}
            from="from-purple-50" to="to-fuchsia-50" iconBg="bg-purple-100"
            trend={usage.length > 5 ? 'up' : 'neutral'} />

          <StatCard label="Calls Today"  value={busy ? '—' : todayCalls}         sub={missed ? `${missed} missed` : 'All answered'}
            icon={<Phone size={19} className="text-sky-600" />}
            from="from-sky-50" to="to-cyan-50" iconBg="bg-sky-100"
            trend={missed > 2 ? 'down' : todayCalls > 0 ? 'up' : 'neutral'} />

          <StatCard label="Messages"     value={busy ? '—' : todaySms}           sub="SMS today"
            icon={<MessageSquare size={19} className="text-violet-600" />}
            from="from-violet-50" to="to-indigo-50" iconBg="bg-violet-100"
            trend={todaySms > 0 ? 'up' : 'neutral'} />

          <StatCard label="Alerts"       value={busy ? '—' : notifications.length} sub="Recent"
            icon={<Bell size={19} className="text-amber-600" />}
            from="from-amber-50" to="to-orange-50" iconBg="bg-amber-100"
            trend={notifications.length > 15 ? 'up' : 'neutral'} />

          <StatCard label="Device"       value={selDev?.isOnline ? 'Online' : 'Offline'} sub={timeAgo(selDev?.lastSeen ?? null)}
            icon={selDev?.isOnline
              ? <Wifi size={19} className="text-green-600" />
              : <WifiOff size={19} className="text-gray-400" />}
            from={selDev?.isOnline ? 'from-green-50' : 'from-gray-50'}
            to={selDev?.isOnline ? 'to-emerald-50' : 'to-slate-50'}
            iconBg={selDev?.isOnline ? 'bg-green-100' : 'bg-gray-100'}
            trend={selDev?.isOnline ? 'up' : 'down'} />
        </div>

        {/* ── Row 2: App Donut | Calls Chart | Location ────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* App Usage Donut */}
          <SCard title="App Usage" sub={`${usage.length} apps · ${msToHm(totalMs)} total`}
            icon={<BarChart2 size={15} />} href="/dashboard/apps">
            {busy ? (
              <div className="space-y-3">{Array.from({length:4}).map((_,i) => <Sk key={i} h="h-5"/>)}</div>
            ) : topApps.length === 0 ? (
              <Empty icon={<BarChart2 size={40}/>} msg="No app usage data yet" />
            ) : (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={68}
                      dataKey="value" paddingAngle={3} stroke="none">
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<ChartTip />} formatter={(v: number) => [`${v}m`]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {topApps.map((app, i) => {
                    const pct = totalMs > 0 ? Math.round(Number(app.usageDurationMs) / totalMs * 100) : 0;
                    return (
                      <div key={app.id} className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-xs font-medium text-gray-700 flex-1 truncate">{app.appName}</span>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">{msToHm(Number(app.usageDurationMs))}</span>
                        <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                        </div>
                        <span className="text-[10px] text-gray-400 w-6 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </SCard>

          {/* Calls Bar Chart */}
          <SCard title="Call Activity" sub={`${calls.length} total · ${missed} missed`}
            icon={<Phone size={15} />} href="/dashboard/calls">
            {busy ? <Sk h="h-56" /> : calls.length === 0 ? (
              <Empty icon={<Phone size={40}/>} msg="No call data yet" />
            ) : (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={callChart} barSize={40} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={24} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: '#f9fafb', radius: 8 }} />
                    <Bar dataKey="value" radius={[7, 7, 0, 0]}>
                      {callChart.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { label: 'Incoming', count: incoming, color: '#10b981', bg: 'bg-green-50',   text: 'text-green-700',  Icon: PhoneIncoming  },
                    { label: 'Outgoing', count: outgoing, color: '#6366f1', bg: 'bg-indigo-50',  text: 'text-indigo-700', Icon: PhoneOutgoing  },
                    { label: 'Missed',   count: missed,   color: '#ef4444', bg: 'bg-red-50',     text: 'text-red-700',    Icon: PhoneMissed    },
                  ].map(({ label, count, bg, text, Icon }) => (
                    <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                      <Icon size={16} className={`${text} mx-auto mb-1`} />
                      <p className={`text-lg font-extrabold ${text}`}>{count}</p>
                      <p className="text-[10px] text-gray-500 font-medium">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SCard>

          {/* Live Location */}
          <SCard title="Last Location" sub={location ? timeAgo(location.capturedAt) : 'Unavailable'}
            icon={<MapPin size={15} />} href="/dashboard/location">
            {busy ? <Sk h="h-56" /> : !location ? (
              <Empty icon={<MapPin size={40}/>} msg="Location not available" />
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden ring-1 ring-gray-100 shadow-sm">
                  <iframe
                    key={`${location.latitude},${location.longitude}`}
                    title="map"
                    src={`https://www.google.com/maps?q=${location.latitude},${location.longitude}&z=15&output=embed`}
                    width="100%" height="168" style={{ border: 0 }} loading="lazy"
                  />
                </div>
                <div className="flex items-start gap-2.5 bg-gray-50 rounded-xl px-3.5 py-3">
                  <MapPin size={14} className="text-primary mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 leading-snug">{location.address ?? 'Unknown address'}</p>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                      {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                      {location.accuracy ? ` · ±${Math.round(location.accuracy)}m` : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </SCard>
        </div>

        {/* ── Row 3: Activity | Browsing | Gallery ──────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* Activity Timeline */}
          <SCard title="Recent Activity" sub={`${notifications.length} notifications`}
            icon={<Activity size={15} />} href="/dashboard/notifications">
            {busy ? (
              <div className="space-y-3">{Array.from({length:5}).map((_,i)=><Sk key={i} h="h-12"/>)}</div>
            ) : notifications.length === 0 ? (
              <Empty icon={<Bell size={40}/>} msg="No activity yet" />
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                {notifications.slice(0, 9).map((n, i) => (
                  <div key={n.id} className="flex gap-3 items-start p-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-[10px] font-extrabold"
                      style={{ background: COLORS[i % COLORS.length] + '20', color: COLORS[i % COLORS.length] }}>
                      {n.appName?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-900 truncate">{n.appName}</p>
                        <p className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">{timeAgo(n.postedAt)}</p>
                      </div>
                      <p className="text-[11px] text-gray-500 truncate">{n.title ?? n.body ?? '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SCard>

          {/* Browsing Top Sites */}
          <SCard title="Browsing Activity" sub={`${browsing.length} pages visited`}
            icon={<Globe size={15} />} href="/dashboard/browsing">
            {busy ? (
              <div className="space-y-3">{Array.from({length:5}).map((_,i)=><Sk key={i} h="h-11"/>)}</div>
            ) : browsing.length === 0 ? (
              <Empty icon={<Globe size={40}/>} msg="No browsing data yet" />
            ) : (
              <div className="space-y-2">
                {topDomains.map(([domain, count], i) => (
                  <div key={domain} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-extrabold flex-shrink-0"
                      style={{ background: COLORS[i % COLORS.length] + '18', color: COLORS[i % COLORS.length] }}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{domain}</p>
                      <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.round(count / maxVisits * 100)}%`, background: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-gray-500 flex-shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </SCard>

          {/* Gallery Grid */}
          <SCard title="Recent Media" sub={`${gallery.length} synced items`}
            icon={<ImageIcon size={15} />} href="/dashboard/gallery" noPad>
            {busy ? (
              <div className="p-5 grid grid-cols-3 gap-2">
                {Array.from({length:6}).map((_,i)=><Sk key={i} h="h-16" />)}
              </div>
            ) : gallery.length === 0 ? (
              <div className="p-5"><Empty icon={<ImageIcon size={40}/>} msg="No media synced yet" /></div>
            ) : (
              <div className="grid grid-cols-3 gap-0.5">
                {gallery.slice(0, 9).map((item) => {
                  const src = item.imageUrl
                    ? `${API_URL}${item.imageUrl}`
                    : item.thumbnail ? `data:image/jpeg;base64,${item.thumbnail}` : null;
                  const isVid = item.mimeType?.startsWith('video/');
                  return (
                    <div key={item.id} className="relative aspect-square bg-gray-100 overflow-hidden group cursor-pointer">
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt={item.fileName}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon size={18} className="text-gray-300" />
                        </div>
                      )}
                      {isVid && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                          <div className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center shadow">
                            <div className="w-0 h-0 border-l-[9px] border-l-gray-800 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent ml-1" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SCard>
        </div>

        {/* ── Row 4: SMS | Devices | Quick Actions ─────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* SMS List */}
          <SCard title="Recent SMS" sub={`${sms.length} messages`}
            icon={<MessageSquare size={15} />} href="/dashboard/sms">
            {busy ? (
              <div className="space-y-3">{Array.from({length:4}).map((_,i)=><Sk key={i} h="h-12"/>)}</div>
            ) : sms.length === 0 ? (
              <Empty icon={<MessageSquare size={40}/>} msg="No SMS data yet" />
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                {sms.slice(0, 7).map((s) => (
                  <div key={s.id} className="flex gap-3 items-start p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold
                      ${s.type === 1 ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                      {s.address?.charAt(0).toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-900 truncate">{s.address}</p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0
                          ${s.type === 1 ? 'bg-indigo-50 text-indigo-500' : 'bg-gray-100 text-gray-400'}`}>
                          {s.type === 1 ? 'IN' : 'OUT'}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SCard>

          {/* All Devices */}
          <SCard title="Registered Devices" sub={`${devices.length} devices`}
            icon={<Smartphone size={15} />} href="/dashboard/devices">
            {devices.length === 0 ? (
              <Empty icon={<Smartphone size={40}/>} msg="No devices registered" />
            ) : (
              <div className="space-y-2">
                {devices.map((d) => (
                  <div key={d.id}
                    onClick={() => d.role === 'child' && setSelected(d.deviceId)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all
                      ${d.deviceId === selected
                        ? 'border-primary/25 bg-primary/5 cursor-pointer'
                        : d.role === 'child'
                          ? 'border-gray-100 hover:border-gray-200 hover:bg-gray-50 cursor-pointer'
                          : 'border-gray-100 bg-gray-50 cursor-default'}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                      ${d.role === 'child' ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                      <Smartphone size={15} className={d.role === 'child' ? 'text-indigo-600' : 'text-gray-400'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{d.name}</p>
                      <p className="text-[10px] text-gray-400 capitalize">{d.role} · {timeAgo(d.lastSeen)}</p>
                    </div>
                    <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full
                      ${d.isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${d.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                      {d.isOnline ? 'Live' : 'Offline'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SCard>

          {/* Quick Actions */}
          <SCard title="Quick Actions" sub="Jump to features" icon={<Zap size={15} />}>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Take Photo',    Icon: Camera,       href: '/dashboard/remote/camera',     c: 'text-violet-600', bg: 'bg-violet-50 hover:bg-violet-100 border-violet-100' },
                { label: 'Screenshot',    Icon: Eye,          href: '/dashboard/remote/screenshot', c: 'text-sky-600',    bg: 'bg-sky-50 hover:bg-sky-100 border-sky-100' },
                { label: 'Geo Fencing',   Icon: MapPin,       href: '/dashboard/geofencing',        c: 'text-green-600',  bg: 'bg-green-50 hover:bg-green-100 border-green-100' },
                { label: 'Block Apps',    Icon: Shield,       href: '/dashboard/blocked-apps',      c: 'text-red-600',    bg: 'bg-red-50 hover:bg-red-100 border-red-100' },
                { label: 'Contacts',      Icon: Users,        href: '/dashboard/contacts',          c: 'text-orange-600', bg: 'bg-orange-50 hover:bg-orange-100 border-orange-100' },
                { label: 'Remote Access', Icon: Activity,     href: '/dashboard/remote',            c: 'text-indigo-600', bg: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-100' },
              ].map(({ label, Icon, href, c, bg }) => (
                <Link key={label} href={href}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center
                    transition-all duration-150 group ${bg}`}>
                  <Icon size={20} className={`${c} group-hover:scale-110 transition-transform duration-150`} />
                  <span className={`text-[11px] font-bold ${c}`}>{label}</span>
                </Link>
              ))}
            </div>
          </SCard>
        </div>

      </div>
    </div>
  );
}
