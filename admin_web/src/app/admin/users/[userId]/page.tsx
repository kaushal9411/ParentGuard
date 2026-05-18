'use client';
import { useEffect, useState, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

function galleryImgSrc(item: { imageUrl: string | null; thumbnail: string | null }): string | null {
  if (item.imageUrl) return `${API_URL}${item.imageUrl}`;
  if (item.thumbnail) return `data:image/jpeg;base64,${item.thumbnail}`;
  return null;
}
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, User, Mail, Calendar, Smartphone, MapPin, Bell, BarChart2,
  Wifi, WifiOff, Clock, Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Contact as ContactIcon, Image, Video, Globe, Activity, Battery, Signal,
  Camera, Mic, Radio, Monitor, FolderOpen, Shield, Eye, Trash2,
  ChevronDown, ChevronUp, Search,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DeviceCount {
  locationLogs: number; appUsageLogs: number; notificationLogs: number;
  statusLogs: number; callLogs: number; contacts: number; galleryItems: number; browsingHistory: number;
}
interface Device {
  id: string; deviceId: string; name: string; role: string;
  isOnline: boolean; lastSeen: string | null; ipAddress: string | null; registeredAt: string;
  _count: DeviceCount;
}
interface LocationLog { id: string; deviceId: string; latitude: number; longitude: number; accuracy: number | null; address: string | null; capturedAt: string; }
interface NotifByApp { [app: string]: { id: string; title: string | null; body: string | null; postedAt: string; }[]; }
interface UsageLog { id: string; appName: string; packageName: string; usageDurationMs: string; capturedAt: string; }
interface CallLog { id: string; number: string; name: string | null; type: string; duration: number; timestamp: string; }
interface Contact { id: string; name: string; phones: string; emails: string; }
interface GalleryItem { id: string; fileName: string; mimeType: string; sizeBytes: string; width: number | null; height: number | null; duration: number | null; takenAt: string | null; thumbnail: string | null; imageUrl: string | null; album: string | null; }
interface BrowsingItem { id: string; url: string; title: string | null; visitedAt: string; }
interface StatusLog { batteryLevel: number; isCharging: boolean; networkType: string; isConnected: boolean; wifiSsid: string | null; signalStrength: number | null; capturedAt: string; }

interface UserDetail {
  user: { id: string; name: string; email: string; role: string; createdAt: string; };
  devices: Device[];
  latestStatus: StatusLog | null;
  recentLocations: LocationLog[];
  notifByApp: NotifByApp;
  recentUsage: UsageLog[];
  recentCallLogs: CallLog[];
  contacts: Contact[];
  galleryItems: GalleryItem[];
  browsingHistory: BrowsingItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

function msToHm(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ─── Tab definitions ──────────────────────────────────────────────────────────
type Tab = 'overview' | 'location' | 'calls' | 'contacts' | 'gallery' | 'notifications' | 'usage' | 'browsing' | 'remote';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'overview',      label: 'Overview',       icon: <User size={14} /> },
  { key: 'location',      label: 'Location',       icon: <MapPin size={14} /> },
  { key: 'calls',         label: 'Call Logs',      icon: <Phone size={14} /> },
  { key: 'contacts',      label: 'Contacts',       icon: <ContactIcon size={14} /> },
  { key: 'gallery',       label: 'Gallery',        icon: <Image size={14} /> },
  { key: 'notifications', label: 'Notifications',  icon: <Bell size={14} /> },
  { key: 'usage',         label: 'App Usage',      icon: <BarChart2 size={14} /> },
  { key: 'browsing',      label: 'Browsing',       icon: <Globe size={14} /> },
  { key: 'remote',        label: 'Remote Access',  icon: <Radio size={14} /> },
];

// ─── Small UI atoms ───────────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-gray-900 border border-gray-800 rounded-2xl ${className}`}>{children}</div>;
}

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-indigo-400">{icon}</span>
      <h3 className="text-white font-bold">{title}</h3>
      {count !== undefined && (
        <span className="ml-auto text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{count.toLocaleString()}</span>
      )}
    </div>
  );
}

function Empty({ msg = 'No data available' }: { msg?: string }) {
  return <p className="text-gray-500 text-sm py-4 text-center">{msg}</p>;
}

function CallTypeBadge({ type }: { type: string }) {
  const map: Record<string, { color: string; Icon: LucideIcon }> = {
    incoming:  { color: 'text-green-400 bg-green-900/30',   Icon: PhoneIncoming },
    outgoing:  { color: 'text-blue-400 bg-blue-900/30',     Icon: PhoneOutgoing },
    missed:    { color: 'text-red-400 bg-red-900/30',       Icon: PhoneMissed },
    rejected:  { color: 'text-orange-400 bg-orange-900/30', Icon: PhoneMissed },
  };
  const { color, Icon } = map[type] ?? { color: 'text-gray-400 bg-gray-800', Icon: Phone };
  return (
    <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${color}`}>
      <Icon size={10} /> {type}
    </span>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────
function OverviewTab({ data }: { data: UserDetail }) {
  const { user, devices, latestStatus } = data;

  const totals = {
    locations:     devices.reduce((s, d) => s + d._count.locationLogs, 0),
    notifications: devices.reduce((s, d) => s + d._count.notificationLogs, 0),
    usage:         devices.reduce((s, d) => s + d._count.appUsageLogs, 0),
    calls:         devices.reduce((s, d) => s + d._count.callLogs, 0),
    contacts:      devices.reduce((s, d) => s + d._count.contacts, 0),
    gallery:       devices.reduce((s, d) => s + d._count.galleryItems, 0),
    browsing:      devices.reduce((s, d) => s + d._count.browsingHistory, 0),
  };

  const statCards = [
    { label: 'Location Logs',  value: totals.locations,     icon: <MapPin size={18} className="text-orange-400" />,  bg: 'bg-orange-600/10 border-orange-800/40' },
    { label: 'Call Logs',      value: totals.calls,         icon: <Phone size={18} className="text-green-400" />,    bg: 'bg-green-600/10 border-green-800/40' },
    { label: 'Contacts',       value: totals.contacts,      icon: <ContactIcon size={18} className="text-cyan-400" />, bg: 'bg-cyan-600/10 border-cyan-800/40' },
    { label: 'Gallery Items',  value: totals.gallery,       icon: <Image size={18} className="text-pink-400" />,     bg: 'bg-pink-600/10 border-pink-800/40' },
    { label: 'Notifications',  value: totals.notifications, icon: <Bell size={18} className="text-red-400" />,       bg: 'bg-red-600/10 border-red-800/40' },
    { label: 'App Usage',      value: totals.usage,         icon: <BarChart2 size={18} className="text-purple-400" />, bg: 'bg-purple-600/10 border-purple-800/40' },
    { label: 'Browser History',value: totals.browsing,      icon: <Globe size={18} className="text-yellow-400" />,   bg: 'bg-yellow-600/10 border-yellow-800/40' },
    { label: 'Devices',        value: devices.length,       icon: <Smartphone size={18} className="text-blue-400" />, bg: 'bg-blue-600/10 border-blue-800/40' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className={`border rounded-2xl p-4 ${s.bg}`}>
            <div className="mb-2">{s.icon}</div>
            <p className="text-2xl font-extrabold text-white">{s.value.toLocaleString()}</p>
            <p className="text-gray-400 text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Device status + device list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latest device status */}
        <Card className="p-6 lg:col-span-1">
          <SectionHeader icon={<Activity size={18} />} title="Device Status" />
          {!latestStatus ? <Empty msg="No status data" /> : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm flex items-center gap-2"><Battery size={14} /> Battery</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${latestStatus.batteryLevel}%` }} />
                  </div>
                  <span className="text-white text-sm font-semibold">{latestStatus.batteryLevel}%{latestStatus.isCharging ? ' ⚡' : ''}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm flex items-center gap-2"><Wifi size={14} /> Network</span>
                <span className="text-white text-sm font-semibold">{latestStatus.networkType} {latestStatus.wifiSsid ? `(${latestStatus.wifiSsid})` : ''}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm flex items-center gap-2"><Signal size={14} /> Signal</span>
                <span className="text-white text-sm font-semibold">{latestStatus.signalStrength ?? '—'} dBm</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Connected</span>
                <span className={`text-sm font-semibold ${latestStatus.isConnected ? 'text-green-400' : 'text-red-400'}`}>
                  {latestStatus.isConnected ? 'Yes' : 'No'}
                </span>
              </div>
              <p className="text-gray-600 text-xs mt-2">Updated {timeAgo(latestStatus.capturedAt)}</p>
            </div>
          )}
        </Card>

        {/* Devices list */}
        <Card className="p-6 lg:col-span-2">
          <SectionHeader icon={<Smartphone size={18} />} title="Registered Devices" count={devices.length} />
          {devices.length === 0 ? <Empty msg="No devices registered" /> : (
            <div className="space-y-3">
              {devices.map((d) => (
                <div key={d.id} className="bg-gray-800/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gray-700 rounded-xl flex items-center justify-center">
                        <Smartphone size={16} className="text-gray-300" />
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">{d.name}</p>
                        <p className="text-gray-500 text-xs font-mono">{d.deviceId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs capitalize bg-gray-700 px-2 py-0.5 rounded-full text-gray-300">{d.role}</span>
                      {d.isOnline
                        ? <span className="flex items-center gap-1 text-green-400 text-xs"><Wifi size={11} /> Online</span>
                        : <span className="flex items-center gap-1 text-gray-500 text-xs"><WifiOff size={11} /> Offline</span>}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs text-center">
                    {[
                      { icon: <MapPin size={11} />, val: d._count.locationLogs, label: 'Locs' },
                      { icon: <Phone size={11} />,  val: d._count.callLogs,     label: 'Calls' },
                      { icon: <Bell size={11} />,   val: d._count.notificationLogs, label: 'Notifs' },
                      { icon: <Globe size={11} />,  val: d._count.browsingHistory,  label: 'URLs' },
                    ].map((s) => (
                      <div key={s.label} className="bg-gray-700/50 rounded-lg py-1.5">
                        <div className="flex justify-center text-gray-400 mb-0.5">{s.icon}</div>
                        <p className="text-white font-bold">{s.val}</p>
                        <p className="text-gray-500">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                    <span>IP: {d.ipAddress ?? '—'}</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {timeAgo(d.lastSeen)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── Tab: Location ────────────────────────────────────────────────────────────
function LocationTab({ data }: { data: UserDetail }) {
  const { recentLocations } = data;
  const latest = recentLocations[0];

  return (
    <div className="space-y-6">
      {latest && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-indigo-400" />
              <span className="text-white font-bold">Live Map</span>
            </div>
            <span className="text-xs text-gray-500">Last seen {timeAgo(latest.capturedAt)}</span>
          </div>
          <iframe
            title="location-map"
            className="w-full h-80 border-0"
            loading="lazy"
            src={`https://maps.google.com/maps?q=${latest.latitude},${latest.longitude}&z=16&output=embed`}
          />
          <div className="p-4 bg-gray-800/50">
            <p className="text-white text-sm font-mono">{latest.latitude.toFixed(6)}, {latest.longitude.toFixed(6)}</p>
            {latest.address && <p className="text-gray-400 text-sm mt-0.5">{latest.address}</p>}
            {latest.accuracy && <p className="text-gray-500 text-xs mt-1">Accuracy: ±{latest.accuracy.toFixed(0)}m</p>}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <SectionHeader icon={<MapPin size={18} />} title="Location History" count={recentLocations.length} />
        {recentLocations.length === 0 ? <Empty msg="No location data" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs">
                  <th className="text-left pb-3 pr-4">Coordinates</th>
                  <th className="text-left pb-3 pr-4">Address</th>
                  <th className="text-left pb-3 pr-4">Accuracy</th>
                  <th className="text-left pb-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {recentLocations.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 pr-4 font-mono text-xs text-indigo-300">{l.latitude.toFixed(5)}, {l.longitude.toFixed(5)}</td>
                    <td className="py-3 pr-4 text-gray-300 max-w-xs truncate">{l.address ?? '—'}</td>
                    <td className="py-3 pr-4 text-gray-400">{l.accuracy ? `±${l.accuracy.toFixed(0)}m` : '—'}</td>
                    <td className="py-3 text-gray-500 text-xs whitespace-nowrap">{timeAgo(l.capturedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Tab: Call Logs ───────────────────────────────────────────────────────────
function CallsTab({ data }: { data: UserDetail }) {
  const { recentCallLogs } = data;
  const [search, setSearch] = useState('');
  const filtered = recentCallLogs.filter((c) =>
    c.number.includes(search) || (c.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    incoming: recentCallLogs.filter((c) => c.type === 'incoming').length,
    outgoing: recentCallLogs.filter((c) => c.type === 'outgoing').length,
    missed:   recentCallLogs.filter((c) => c.type === 'missed').length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Incoming', value: stats.incoming, color: 'text-green-400 bg-green-900/20 border-green-800/40' },
          { label: 'Outgoing', value: stats.outgoing, color: 'text-blue-400 bg-blue-900/20 border-blue-800/40' },
          { label: 'Missed',   value: stats.missed,   color: 'text-red-400 bg-red-900/20 border-red-800/40' },
        ].map((s) => (
          <div key={s.label} className={`border rounded-2xl p-4 ${s.color}`}>
            <p className="text-2xl font-extrabold">{s.value}</p>
            <p className="text-xs mt-0.5 opacity-70">{s.label} calls</p>
          </div>
        ))}
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <SectionHeader icon={<Phone size={18} />} title="Call Log" count={recentCallLogs.length} />
          <div className="ml-auto relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search number or name…"
              className="bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-48" />
          </div>
        </div>
        {filtered.length === 0 ? <Empty msg="No call logs" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs">
                  <th className="text-left pb-3 pr-4">Contact</th>
                  <th className="text-left pb-3 pr-4">Number</th>
                  <th className="text-left pb-3 pr-4">Type</th>
                  <th className="text-left pb-3 pr-4">Duration</th>
                  <th className="text-left pb-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 pr-4 text-white font-medium">{c.name ?? <span className="text-gray-500 italic">Unknown</span>}</td>
                    <td className="py-3 pr-4 text-gray-300 font-mono text-xs">{c.number}</td>
                    <td className="py-3 pr-4"><CallTypeBadge type={c.type} /></td>
                    <td className="py-3 pr-4 text-gray-300">{fmtDuration(c.duration)}</td>
                    <td className="py-3 text-gray-500 text-xs whitespace-nowrap">{timeAgo(c.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Tab: Contacts ────────────────────────────────────────────────────────────
function ContactsTab({ data }: { data: UserDetail }) {
  const { contacts } = data;
  const [search, setSearch] = useState('');
  const filtered = contacts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <SectionHeader icon={<ContactIcon size={18} />} title="Contacts" count={contacts.length} />
        <div className="ml-auto relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts…"
            className="bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-48" />
        </div>
      </div>
      {filtered.length === 0 ? <Empty msg="No contacts found" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((c) => {
            const phones: string[] = JSON.parse(c.phones || '[]');
            const emails: string[] = JSON.parse(c.emails || '[]');
            return (
              <div key={c.id} className="bg-gray-800/50 rounded-xl p-4 flex items-start gap-3">
                <div className="w-9 h-9 bg-indigo-700/40 rounded-full flex items-center justify-center text-indigo-300 font-bold text-sm flex-shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{c.name}</p>
                  {phones.map((p, i) => (
                    <p key={i} className="text-gray-400 text-xs flex items-center gap-1 mt-0.5">
                      <Phone size={10} /> {p}
                    </p>
                  ))}
                  {emails.map((e, i) => (
                    <p key={i} className="text-gray-400 text-xs flex items-center gap-1 mt-0.5">
                      <Mail size={10} /> {e}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Gallery lightbox modal ───────────────────────────────────────────────────
function GalleryLightbox({
  item, items, onClose, onNav,
}: {
  item: GalleryItem;
  items: GalleryItem[];
  onClose: () => void;
  onNav: (item: GalleryItem) => void;
}) {
  const isVideo = item.mimeType.startsWith('video');
  const idx     = items.findIndex((g) => g.id === item.id);

  // keyboard navigation + close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && idx < items.length - 1) onNav(items[idx + 1]);
      if (e.key === 'ArrowLeft'  && idx > 0)                onNav(items[idx - 1]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onNav, idx, items]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm truncate">{item.fileName}</p>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
            <span>{item.mimeType}</span>
            <span>{fmtBytes(Number(item.sizeBytes))}</span>
            {item.width && item.height && <span>{item.width}×{item.height}</span>}
            {item.duration && <span>{fmtDuration(item.duration)}</span>}
            {item.takenAt && <span>{new Date(item.takenAt).toLocaleString()}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
          <span className="text-gray-500 text-xs">{idx + 1} / {items.length}</span>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Media area */}
      <div className="flex-1 flex items-center justify-center relative min-h-0 px-16" onClick={(e) => e.stopPropagation()}>
        {/* Prev */}
        {idx > 0 && (
          <button
            onClick={() => onNav(items[idx - 1])}
            className="absolute left-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-xl transition-colors z-10"
          >
            ‹
          </button>
        )}

        {isVideo ? (
          item.imageUrl ? (
            <video
              key={item.id}
              src={`${API_URL}${item.imageUrl}`}
              controls
              autoPlay={false}
              className="max-w-full max-h-full rounded-lg"
              style={{ maxHeight: 'calc(100vh - 160px)' }}
            />
          ) : galleryImgSrc(item) ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={galleryImgSrc(item)!}
                alt={item.fileName}
                className="max-w-full max-h-full object-contain rounded-lg select-none opacity-60"
                style={{ maxHeight: 'calc(100vh - 160px)' }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-300">
                <Video size={48} />
                <p className="text-sm">Video not yet uploaded</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-gray-500">
              <Video size={64} />
              <p className="text-sm">Preview not available</p>
            </div>
          )
        ) : galleryImgSrc(item) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={galleryImgSrc(item)!}
            alt={item.fileName}
            className="max-w-full max-h-full object-contain rounded-lg select-none"
            style={{ maxHeight: 'calc(100vh - 160px)' }}
          />
        ) : (
          <div className="flex flex-col items-center gap-4 text-gray-500">
            <Image size={64} />
            <p className="text-sm">Preview not available</p>
          </div>
        )}

        {/* Next */}
        {idx < items.length - 1 && (
          <button
            onClick={() => onNav(items[idx + 1])}
            className="absolute right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-xl transition-colors z-10"
          >
            ›
          </button>
        )}
      </div>

      {/* Bottom strip — thumbnail strip for quick navigation */}
      <div className="flex-shrink-0 flex items-center gap-2 px-6 py-4 overflow-x-auto" onClick={(e) => e.stopPropagation()}>
        {items.map((g) => {
          const src = galleryImgSrc(g);
          return (
            <button
              key={g.id}
              onClick={() => onNav(g)}
              className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${g.id === item.id ? 'border-indigo-400 opacity-100' : 'border-transparent opacity-50 hover:opacity-80'}`}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                  {g.mimeType.startsWith('video') ? <Video size={16} className="text-gray-400" /> : <Image size={16} className="text-gray-400" />}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Gallery grid (shared between album view and flat view) ──────────────────
function GalleryGrid({
  items,
  onOpen,
}: {
  items: GalleryItem[];
  onOpen: (item: GalleryItem) => void;
}) {
  if (items.length === 0) return <Empty msg="No items in this folder" />;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
      {items.map((g) => {
        const isVideo = g.mimeType.startsWith('video');
        const src = galleryImgSrc(g);
        return (
          <button
            key={g.id}
            onClick={() => onOpen(g)}
            className="bg-gray-800 rounded-xl overflow-hidden text-left hover:ring-2 hover:ring-indigo-500 transition-all group"
          >
            <div className="aspect-square bg-gray-700 flex items-center justify-center relative overflow-hidden">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={g.fileName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
              ) : (
                isVideo ? <Video size={24} className="text-purple-400" /> : <Image size={24} className="text-pink-400" />
              )}
              {isVideo && (
                <>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Video size={14} className="text-white ml-0.5" />
                    </div>
                  </div>
                  {g.duration && (
                    <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 py-0.5 rounded">
                      {fmtDuration(g.duration)}
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="px-1.5 py-1">
              <p className="text-white text-[10px] truncate">{g.fileName}</p>
              <p className="text-gray-600 text-[10px]">{fmtBytes(Number(g.sizeBytes))}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Tab: Gallery ─────────────────────────────────────────────────────────────
function GalleryTab({ data }: { data: UserDetail }) {
  const { galleryItems } = data;
  const [lightbox, setLightbox]   = useState<GalleryItem | null>(null);
  const [album, setAlbum]         = useState<string>('__all__');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video'>('all');

  // Build ordered album list: sort by item count desc
  const albumMap = galleryItems.reduce<Record<string, GalleryItem[]>>((acc, g) => {
    const key = g.album || 'Unknown';
    (acc[key] ??= []).push(g);
    return acc;
  }, {});
  const albums = Object.entries(albumMap).sort((a, b) => b[1].length - a[1].length);

  const baseItems = album === '__all__' ? galleryItems : (albumMap[album] ?? []);
  const visibleItems = typeFilter === 'all' ? baseItems : baseItems.filter((g) => g.mimeType.startsWith(typeFilter));

  // Lightbox navigates only within visibleItems
  const openLightbox = (item: GalleryItem) => setLightbox(item);

  const images = galleryItems.filter((g) => g.mimeType.startsWith('image')).length;
  const videos = galleryItems.filter((g) => g.mimeType.startsWith('video')).length;

  // Icon for known album names
  const albumIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('camera'))     return <Camera size={14} />;
    if (n.includes('screenshot')) return <Monitor size={14} />;
    if (n.includes('video'))      return <Video size={14} />;
    if (n.includes('download'))   return <FolderOpen size={14} />;
    return <Image size={14} />;
  };

  return (
    <>
      {lightbox && (
        <GalleryLightbox
          item={lightbox}
          items={visibleItems}
          onClose={() => setLightbox(null)}
          onNav={setLightbox}
        />
      )}

      <div className="space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Items', value: galleryItems.length, color: 'text-white' },
            { label: 'Photos',      value: images,              color: 'text-pink-400' },
            { label: 'Videos',      value: videos,              color: 'text-purple-400' },
          ].map((s) => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
              <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
              <p className="text-gray-400 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-5">
          {/* ── Album sidebar ── */}
          <div className="flex-shrink-0 w-48">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2 px-1">Folders</p>
            <div className="space-y-1">
              <button
                onClick={() => setAlbum('__all__')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors ${album === '__all__' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <FolderOpen size={14} className="flex-shrink-0" />
                  <span className="truncate">All Photos</span>
                </span>
                <span className={`text-xs flex-shrink-0 ml-1 ${album === '__all__' ? 'text-indigo-200' : 'text-gray-600'}`}>{galleryItems.length}</span>
              </button>
              {albums.map(([name, items]) => (
                <button
                  key={name}
                  onClick={() => setAlbum(name)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors ${album === name ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="flex-shrink-0">{albumIcon(name)}</span>
                    <span className="truncate">{name}</span>
                  </span>
                  <span className={`text-xs flex-shrink-0 ml-1 ${album === name ? 'text-indigo-200' : 'text-gray-600'}`}>{items.length}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Grid area ── */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold text-sm">
                {album === '__all__' ? 'All Photos & Videos' : album}
                <span className="text-gray-500 font-normal ml-2 text-xs">{visibleItems.length} items</span>
              </h3>
              <div className="flex items-center gap-1.5">
                {(['all', 'image', 'video'] as const).map((f) => (
                  <button key={f} onClick={() => setTypeFilter(f)}
                    className={`text-xs px-2.5 py-1 rounded-full transition-colors ${typeFilter === f ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                    {f === 'all' ? 'All' : f === 'image' ? 'Photos' : 'Videos'}
                  </button>
                ))}
              </div>
            </div>
            <GalleryGrid items={visibleItems} onOpen={openLightbox} />
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Tab: Notifications ───────────────────────────────────────────────────────
function NotificationsTab({ data }: { data: UserDetail }) {
  const { notifByApp } = data;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const apps = Object.keys(notifByApp);
  const total = Object.values(notifByApp).reduce((s, arr) => s + arr.length, 0);

  const toggle = (app: string) => setExpanded((prev) => ({ ...prev, [app]: !prev[app] }));

  return (
    <Card className="p-6">
      <SectionHeader icon={<Bell size={18} />} title="Notifications by App" count={total} />
      {apps.length === 0 ? <Empty msg="No notifications yet" /> : (
        <div className="space-y-3">
          {apps.map((app) => {
            const notifs = notifByApp[app];
            const isOpen = expanded[app];
            return (
              <div key={app} className="bg-gray-800/50 rounded-xl overflow-hidden">
                <button onClick={() => toggle(app)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-700/30 rounded-lg flex items-center justify-center text-indigo-300 text-xs font-bold">
                      {app.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-white font-semibold text-sm">{app}</span>
                    <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded-full">{notifs.length}</span>
                  </div>
                  {isOpen ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                </button>
                {isOpen && (
                  <div className="border-t border-gray-700 divide-y divide-gray-700/50">
                    {notifs.map((n) => (
                      <div key={n.id} className="px-4 py-3">
                        {n.title && <p className="text-white text-sm font-medium">{n.title}</p>}
                        {n.body && <p className="text-gray-400 text-xs mt-0.5">{n.body}</p>}
                        <p className="text-gray-600 text-xs mt-1">{timeAgo(n.postedAt)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Tab: App Usage ───────────────────────────────────────────────────────────
function UsageTab({ data }: { data: UserDetail }) {
  const { recentUsage } = data;

  const byApp = recentUsage.reduce<Record<string, number>>((acc, u) => {
    acc[u.appName] = (acc[u.appName] ?? 0) + Number(u.usageDurationMs);
    return acc;
  }, {});

  const sorted = Object.entries(byApp).sort((a, b) => b[1] - a[1]);
  const maxMs = sorted[0]?.[1] ?? 1;

  return (
    <Card className="p-6">
      <SectionHeader icon={<BarChart2 size={18} />} title="App Usage" count={recentUsage.length} />
      {sorted.length === 0 ? <Empty msg="No usage data" /> : (
        <div className="space-y-3">
          {sorted.map(([app, ms]) => (
            <div key={app} className="flex items-center gap-4">
              <div className="w-8 h-8 bg-indigo-700/30 rounded-lg flex items-center justify-center text-indigo-300 text-xs font-bold flex-shrink-0">
                {app.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white text-sm font-medium truncate">{app}</span>
                  <span className="text-indigo-300 text-xs font-bold ml-2 flex-shrink-0">{msToHm(ms)}</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(ms / maxMs) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Tab: Browsing History ────────────────────────────────────────────────────
function BrowsingTab({ data }: { data: UserDetail }) {
  const { browsingHistory } = data;
  const [search, setSearch] = useState('');
  const filtered = browsingHistory.filter((b) =>
    b.url.toLowerCase().includes(search.toLowerCase()) ||
    (b.title ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <SectionHeader icon={<Globe size={18} />} title="Browsing History" count={browsingHistory.length} />
        <div className="ml-auto relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search URLs…"
            className="bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-48" />
        </div>
      </div>
      {filtered.length === 0 ? <Empty msg="No browsing history" /> : (
        <div className="divide-y divide-gray-800/50">
          {filtered.map((b) => {
            let domain = '';
            try { domain = new URL(b.url).hostname; } catch {}
            return (
              <div key={b.id} className="py-3 flex items-start gap-3">
                <div className="w-7 h-7 bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Globe size={13} className="text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{b.title ?? domain}</p>
                  <p className="text-gray-500 text-xs truncate">{b.url}</p>
                </div>
                <span className="text-gray-600 text-xs whitespace-nowrap ml-2">{timeAgo(b.visitedAt)}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Types for Remote tab ─────────────────────────────────────────────────────
interface RemoteCommand { id: string; commandType: string; payload: string; status: string; result: string | null; issuedAt: string; completedAt: string | null; }
interface Geofence { id: string; name: string; latitude: number; longitude: number; radiusM: number; isActive: boolean; createdAt: string; }
interface AppBlockRule { id: string; packageName: string; appName: string; isBlocked: boolean; createdAt: string; }

const STATUS_COLOR: Record<string, string> = {
  pending:   'text-yellow-400 bg-yellow-900/30',
  delivered: 'text-blue-400 bg-blue-900/30',
  executing: 'text-indigo-400 bg-indigo-900/30',
  completed: 'text-green-400 bg-green-900/30',
  failed:    'text-red-400 bg-red-900/30',
  cancelled: 'text-gray-500 bg-gray-800',
};

// ─── Tab: Remote Access ───────────────────────────────────────────────────────
function RemoteTab({ data }: { data: UserDetail }) {
  const { devices } = data;
  const [activeDevice, setActiveDevice] = useState<Device | null>(devices[0] ?? null);
  const [commands, setCommands]   = useState<RemoteCommand[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [appBlocks, setAppBlocks] = useState<AppBlockRule[]>([]);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  // Geofence form
  const [gfName, setGfName]   = useState('');
  const [gfLat, setGfLat]     = useState('');
  const [gfLng, setGfLng]     = useState('');
  const [gfRadius, setGfRadius] = useState('500');

  // App block form
  const [abPkg,  setAbPkg]  = useState('');
  const [abName, setAbName] = useState('');

  const deviceId = activeDevice?.deviceId ?? '';

  const reload = useCallback(async () => {
    if (!deviceId) return;
    const [c, g, a] = await Promise.all([
      adminApi.deviceCommands(deviceId),
      adminApi.deviceGeofences(deviceId),
      adminApi.deviceAppBlocks(deviceId),
    ]);
    setCommands(c.data);
    setGeofences(g.data);
    setAppBlocks(a.data);
  }, [deviceId]);

  useEffect(() => { reload(); }, [reload]);

  async function issue(commandType: string, payload?: Record<string, unknown>) {
    if (!deviceId) return;
    setBusy((b) => ({ ...b, [commandType]: true }));
    try {
      await adminApi.issueCommand(deviceId, commandType, payload);
      await reload();
    } finally {
      setBusy((b) => ({ ...b, [commandType]: false }));
    }
  }

  async function createGeofence(e: React.FormEvent) {
    e.preventDefault();
    if (!deviceId) return;
    await adminApi.createGeofence(deviceId, {
      name: gfName, latitude: parseFloat(gfLat),
      longitude: parseFloat(gfLng), radiusM: parseInt(gfRadius),
    });
    setGfName(''); setGfLat(''); setGfLng(''); setGfRadius('500');
    await reload();
  }

  async function addBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!deviceId || !abPkg || !abName) return;
    await adminApi.setAppBlock(deviceId, abPkg, abName, true);
    setAbPkg(''); setAbName('');
    await reload();
  }

  const cmdFeatures = [
    { cmd: 'capture_photo',    icon: <Camera size={20} className="text-pink-400" />,    label: 'Capture Photo',     color: 'bg-pink-600',   payload: { camera: 'back' } },
    { cmd: 'start_mic',        icon: <Mic size={20} className="text-red-400" />,        label: 'Start Mic',         color: 'bg-red-600' },
    { cmd: 'stop_mic',         icon: <Mic size={20} className="text-gray-400" />,       label: 'Stop Mic',          color: 'bg-gray-700' },
    { cmd: 'start_recording',  icon: <Radio size={20} className="text-orange-400" />,   label: 'Start Recording',   color: 'bg-orange-600' },
    { cmd: 'stop_recording',   icon: <Radio size={20} className="text-gray-400" />,     label: 'Stop Recording',    color: 'bg-gray-700' },
    { cmd: 'get_screen',       icon: <Monitor size={20} className="text-blue-400" />,   label: 'Get Screenshot',    color: 'bg-blue-600' },
    { cmd: 'list_files',       icon: <FolderOpen size={20} className="text-yellow-400" />, label: 'List Files',     color: 'bg-yellow-600' },
    { cmd: 'lock_device',      icon: <Shield size={20} className="text-indigo-400" />,  label: 'Lock Device',       color: 'bg-indigo-600' },
  ];

  const inputCls = 'bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-full';

  return (
    <div className="space-y-6">
      {/* Device selector */}
      {devices.length > 1 && (
        <Card className="p-4">
          <p className="text-gray-400 text-xs mb-2">Target device</p>
          <div className="flex flex-wrap gap-2">
            {devices.map((d) => (
              <button key={d.id} onClick={() => setActiveDevice(d)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors
                  ${activeDevice?.id === d.id ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${d.isOnline ? 'bg-green-400' : 'bg-gray-600'}`} />
                {d.name}
              </button>
            ))}
          </div>
        </Card>
      )}

      {activeDevice && !activeDevice.isOnline && (
        <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-2xl p-4 flex items-center gap-3">
          <WifiOff size={16} className="text-yellow-400 flex-shrink-0" />
          <p className="text-yellow-300 text-sm">Device is offline — commands will queue and execute when it comes back online.</p>
        </div>
      )}

      {/* Quick commands */}
      <Card className="p-6">
        <SectionHeader icon={<Radio size={18} />} title="Send Command" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {cmdFeatures.map((f) => (
            <button key={f.cmd} onClick={() => issue(f.cmd, f.payload)}
              disabled={busy[f.cmd] || !deviceId}
              className={`flex flex-col items-center gap-2 py-4 rounded-xl text-white text-xs font-bold
                transition-all active:scale-95 disabled:opacity-40 ${f.color} hover:opacity-90`}>
              {busy[f.cmd]
                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : f.icon}
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Command history */}
      <Card className="p-6">
        <div className="flex items-center mb-4">
          <SectionHeader icon={<Clock size={18} />} title="Command History" count={commands.length} />
          <button onClick={reload} className="ml-auto text-xs text-gray-500 hover:text-white transition-colors">Refresh</button>
        </div>
        {commands.length === 0 ? <Empty msg="No commands issued yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="text-left pb-2 pr-3">Command</th>
                  <th className="text-left pb-2 pr-3">Status</th>
                  <th className="text-left pb-2 pr-3">Issued</th>
                  <th className="text-left pb-2">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {commands.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-800/30">
                    <td className="py-2.5 pr-3 text-white font-mono">{c.commandType}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`px-2 py-0.5 rounded-full font-semibold capitalize ${STATUS_COLOR[c.status] ?? 'text-gray-400'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-gray-500">{timeAgo(c.issuedAt)}</td>
                    <td className="py-2.5 text-gray-400 max-w-xs truncate">
                      {c.result ? (
                        <span title={c.result} className="cursor-help underline decoration-dotted">View result</span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Geofences */}
      <Card className="p-6">
        <SectionHeader icon={<MapPin size={18} />} title="Geofence Zones" count={geofences.length} />
        <form onSubmit={createGeofence} className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5">
          <input value={gfName}   onChange={(e) => setGfName(e.target.value)}   required placeholder="Zone name"  className={inputCls} />
          <input value={gfLat}    onChange={(e) => setGfLat(e.target.value)}    required placeholder="Latitude"   className={inputCls} type="number" step="any" />
          <input value={gfLng}    onChange={(e) => setGfLng(e.target.value)}    required placeholder="Longitude"  className={inputCls} type="number" step="any" />
          <input value={gfRadius} onChange={(e) => setGfRadius(e.target.value)} required placeholder="Radius (m)" className={inputCls} type="number" />
          <button type="submit" className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors">
            Add Zone
          </button>
        </form>
        {geofences.length === 0 ? <Empty msg="No geofence zones set" /> : (
          <div className="space-y-2">
            {geofences.map((g) => (
              <div key={g.id} className="flex items-center justify-between bg-gray-800/50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-white text-sm font-semibold">{g.name}</p>
                  <p className="text-gray-400 text-xs">{g.latitude.toFixed(5)}, {g.longitude.toFixed(5)} · r={g.radiusM}m</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={async () => { await adminApi.toggleGeofence(g.id, !g.isActive); reload(); }}
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${g.isActive ? 'bg-green-900/40 text-green-400 hover:bg-green-900/60' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                    {g.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <button onClick={async () => { await adminApi.deleteGeofence(g.id); reload(); }}
                    className="text-red-500 hover:text-red-400 p-1 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* App block rules */}
      <Card className="p-6">
        <SectionHeader icon={<Shield size={18} />} title="Blocked Apps" count={appBlocks.filter((a) => a.isBlocked).length} />
        <form onSubmit={addBlock} className="flex gap-2 mb-5">
          <input value={abName} onChange={(e) => setAbName(e.target.value)} required placeholder="App name (e.g. TikTok)" className={inputCls} />
          <input value={abPkg}  onChange={(e) => setAbPkg(e.target.value)}  required placeholder="Package (e.g. com.zhiliaoapp.musically)" className={`${inputCls} flex-1`} />
          <button type="submit" className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
            Block App
          </button>
        </form>
        {appBlocks.length === 0 ? <Empty msg="No apps blocked" /> : (
          <div className="space-y-2">
            {appBlocks.map((r) => (
              <div key={r.id} className="flex items-center justify-between bg-gray-800/50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-white text-sm font-semibold">{r.appName}</p>
                  <p className="text-gray-500 text-xs font-mono">{r.packageName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={async () => { await adminApi.setAppBlock(deviceId, r.packageName, r.appName, !r.isBlocked); reload(); }}
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${r.isBlocked ? 'bg-red-900/40 text-red-400 hover:bg-red-900/60' : 'bg-green-900/40 text-green-400 hover:bg-green-900/60'}`}>
                    {r.isBlocked ? 'Blocked' : 'Allowed'}
                  </button>
                  <button onClick={async () => { await adminApi.deleteAppBlock(r.id); reload(); }}
                    className="text-red-500 hover:text-red-400 p-1 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();

  // allDevices persists across device-filter changes so the selector stays populated
  const [allDevices, setAllDevices]       = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [data, setData]                   = useState<UserDetail | null>(null);
  const [loading, setLoading]             = useState(true);
  const [tab, setTab]                     = useState<Tab>('overview');
  const [deleting, setDeleting]           = useState(false);

  const fetchData = useCallback((devId?: string | null) => {
    setLoading(true);
    adminApi.userDetail(userId, devId ?? undefined)
      .then((r) => {
        setData(r.data);
        // Only update the device list on initial load (devId not set)
        if (!devId) setAllDevices(r.data.devices ?? []);
      })
      .catch(() => router.push('/admin/users'))
      .finally(() => setLoading(false));
  }, [userId, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeviceSelect = useCallback((devId: string | null) => {
    setSelectedDeviceId(devId);
    fetchData(devId);
  }, [fetchData]);

  const handleDelete = useCallback(async () => {
    if (!confirm('Permanently delete this user and ALL their data? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await adminApi.deleteUser(userId);
      router.push('/admin/users');
    } finally {
      setDeleting(false);
    }
  }, [userId, router]);

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const { user } = data;
  const devices = allDevices;
  const selectedDevice = selectedDeviceId ? devices.find((d) => d.deviceId === selectedDeviceId) : null;

  const totalRecords = devices.reduce((s, d) =>
    s + d._count.locationLogs + d._count.notificationLogs + d._count.appUsageLogs +
    d._count.callLogs + d._count.contacts + d._count.galleryItems + d._count.browsingHistory, 0
  );

  const tabContent: Record<Tab, React.ReactNode> = {
    overview:      <OverviewTab data={data} />,
    location:      <LocationTab data={data} />,
    calls:         <CallsTab data={data} />,
    contacts:      <ContactsTab data={data} />,
    gallery:       <GalleryTab data={data} />,
    notifications: <NotificationsTab data={data} />,
    usage:         <UsageTab data={data} />,
    browsing:      <BrowsingTab data={data} />,
    remote:        <RemoteTab data={data} />,
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top header */}
      <div className="px-8 pt-8 pb-0 space-y-4">
        <button onClick={() => router.push('/admin/users')}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors">
          <ArrowLeft size={16} /> Back to Users
        </button>

        <div className="flex items-start justify-between pb-5 border-b border-gray-800">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-700 rounded-2xl flex items-center justify-center text-white font-bold text-xl">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">{user.name}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-gray-400 text-sm flex items-center gap-1"><Mail size={13} /> {user.email}</span>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize
                  ${user.role === 'parent' ? 'bg-blue-900/40 text-blue-300' : 'bg-purple-900/40 text-purple-300'}`}>
                  {user.role}
                </span>
                <span className="text-gray-500 text-xs flex items-center gap-1">
                  <Calendar size={12} /> Joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs text-gray-500 hidden md:block">
              <p>{devices.length} device{devices.length !== 1 ? 's' : ''}</p>
              <p>{totalRecords.toLocaleString()} records</p>
            </div>
            <button onClick={handleDelete} disabled={deleting}
              className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl bg-red-900/30 text-red-400 border border-red-800/40 hover:bg-red-800/40 transition-colors disabled:opacity-50">
              <Trash2 size={13} /> {deleting ? 'Deleting…' : 'Delete User'}
            </button>
          </div>
        </div>

        {/* ── Device selector ── */}
        {devices.length > 0 && (
          <div className="flex items-center gap-2 pb-3 overflow-x-auto scrollbar-hide">
            <span className="text-gray-500 text-xs whitespace-nowrap mr-1">View data for:</span>
            <button
              onClick={() => handleDeviceSelect(null)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border
                ${!selectedDeviceId
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700'}`}>
              <Smartphone size={11} /> All Devices
              <span className="ml-1 bg-white/10 px-1.5 py-0.5 rounded-full">{devices.length}</span>
            </button>
            {devices.map((d) => (
              <button key={d.deviceId}
                onClick={() => handleDeviceSelect(d.deviceId)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border
                  ${selectedDeviceId === d.deviceId
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700'}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${d.isOnline ? 'bg-green-400' : 'bg-gray-600'}`} />
                {d.name || d.deviceId.slice(0, 12)}
                {d.isOnline && <span className="text-green-400 text-[10px] ml-0.5">●</span>}
              </button>
            ))}
            {loading && (
              <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin ml-2 flex-shrink-0" />
            )}
          </div>
        )}

        {/* Selected device info bar */}
        {selectedDevice && (
          <div className="flex items-center gap-4 bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-2.5 mb-1">
            <div className="w-7 h-7 bg-indigo-700/50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Smartphone size={14} className="text-indigo-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{selectedDevice.name}</p>
              <p className="text-gray-500 text-[11px] font-mono truncate">{selectedDevice.deviceId}</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 text-xs">
              {selectedDevice.isOnline
                ? <span className="flex items-center gap-1 text-green-400"><Wifi size={11} /> Online</span>
                : <span className="flex items-center gap-1 text-gray-500"><WifiOff size={11} /> Offline</span>}
              <span className="text-gray-500 flex items-center gap-1"><Clock size={10} /> {timeAgo(selectedDevice.lastSeen)}</span>
              <span className="text-gray-600 capitalize">{selectedDevice.role}</span>
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex items-center gap-1 overflow-x-auto pb-px scrollbar-hide">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-semibold whitespace-nowrap transition-colors
                ${tab === t.key
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {tabContent[tab]}
      </div>
    </div>
  );
}
