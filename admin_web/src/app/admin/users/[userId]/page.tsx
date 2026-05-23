'use client';
import { useEffect, useState, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

const VIDEO_EXTS = ['.mp4', '.3gp', '.3g2', '.mpeg', '.mov', '.webm', '.avi'];

function isVideoUrl(url: string | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return VIDEO_EXTS.some((ext) => lower.endsWith(ext));
}

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
  Camera, Mic, Radio, Monitor, AppWindow, FolderOpen, Shield, Eye, Trash2,
  ChevronDown, ChevronUp, ChevronRight, Search, MessageSquare,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import PageLoader from '@/components/PageLoader';
import { confirmDialog, stepConfirm } from '@/lib/confirm';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DeviceCount {
  locationLogs: number; appUsageLogs: number; notificationLogs: number;
  statusLogs: number; callLogs: number; smsLogs: number; contacts: number; galleryItems: number; browsingHistory: number;
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
interface BrowsingItem { id: string; url: string; title: string | null; visitedAt: string; browserApp: string | null; visitCount: number | null; }
interface SmsItem { id: string; deviceId: string; address: string; body: string; type: number; date: string; isRead: boolean; threadId: string | null; subject: string | null; }
interface StatusLog { batteryLevel: number; isCharging: boolean; networkType: string; isConnected: boolean; wifiSsid: string | null; signalStrength: number | null; capturedAt: string; }

interface UserDetail {
  user: { id: string; name: string; email: string; role: string; createdAt: string; };
  devices: Device[];
  latestStatus: StatusLog | null;
  recentLocations: LocationLog[];
  notifByApp: NotifByApp;
  recentUsage: UsageLog[];
  recentCallLogs: CallLog[];
  recentSms: SmsItem[];
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
type Tab = 'overview' | 'location' | 'calls' | 'sms' | 'contacts' | 'gallery' | 'notifications' | 'usage' | 'browsing' | 'remote';

interface TabDef { key: Tab; label: string; Icon: LucideIcon; gradient: string; color: string; }

const TABS: TabDef[] = [
  { key: 'overview',      label: 'Overview',       Icon: User,          gradient: 'from-indigo-500 to-violet-600',  color: '#6366f1' },
  { key: 'location',      label: 'Location',       Icon: MapPin,        gradient: 'from-emerald-500 to-teal-600',   color: '#10b981' },
  { key: 'calls',         label: 'Call Logs',      Icon: Phone,         gradient: 'from-sky-500 to-blue-600',       color: '#0ea5e9' },
  { key: 'sms',           label: 'SMS',            Icon: MessageSquare, gradient: 'from-violet-500 to-purple-600',  color: '#8b5cf6' },
  { key: 'contacts',      label: 'Contacts',       Icon: ContactIcon,   gradient: 'from-orange-500 to-amber-600',   color: '#f97316' },
  { key: 'gallery',       label: 'Gallery',        Icon: Image,         gradient: 'from-pink-500 to-rose-600',      color: '#ec4899' },
  { key: 'notifications', label: 'Notifications',  Icon: Bell,          gradient: 'from-yellow-400 to-orange-500',  color: '#f59e0b' },
  { key: 'usage',         label: 'App Usage',      Icon: BarChart2,     gradient: 'from-cyan-500 to-teal-600',      color: '#06b6d4' },
  { key: 'browsing',      label: 'Browsing',       Icon: Globe,         gradient: 'from-blue-500 to-indigo-600',    color: '#3b82f6' },
  { key: 'remote',        label: 'Remote Access',  Icon: Radio,         gradient: 'from-red-500 to-rose-600',       color: '#ef4444' },
];

const NAV_GROUPS: { label: string; keys: Tab[] }[] = [
  { label: 'General',  keys: ['overview'] },
  { label: 'Monitor',  keys: ['location', 'calls', 'sms', 'contacts', 'gallery', 'notifications'] },
  { label: 'Activity', keys: ['usage', 'browsing'] },
  { label: 'Control',  keys: ['remote'] },
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
function OverviewTab({
  data,
  onDeviceDelete,
}: {
  data: UserDetail;
  onDeviceDelete: (deviceId: string, name: string) => void;
}) {
  const { user, devices, latestStatus } = data;

  const totals = {
    locations:     devices.reduce((s, d) => s + d._count.locationLogs, 0),
    notifications: devices.reduce((s, d) => s + d._count.notificationLogs, 0),
    usage:         devices.reduce((s, d) => s + d._count.appUsageLogs, 0),
    calls:         devices.reduce((s, d) => s + d._count.callLogs, 0),
    sms:           devices.reduce((s, d) => s + (d._count.smsLogs ?? 0), 0),
    contacts:      devices.reduce((s, d) => s + d._count.contacts, 0),
    gallery:       devices.reduce((s, d) => s + d._count.galleryItems, 0),
    browsing:      devices.reduce((s, d) => s + d._count.browsingHistory, 0),
  };

  const statCards = [
    { label: 'Location Logs',  value: totals.locations,     icon: <MapPin size={18} className="text-orange-400" />,  bg: 'bg-orange-600/10 border-orange-800/40' },
    { label: 'Call Logs',      value: totals.calls,         icon: <Phone size={18} className="text-green-400" />,    bg: 'bg-green-600/10 border-green-800/40' },
    { label: 'SMS Messages',   value: totals.sms,           icon: <MessageSquare size={18} className="text-violet-400" />, bg: 'bg-violet-600/10 border-violet-800/40' },
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
                      <button
                        onClick={() => onDeviceDelete(d.deviceId, d.name)}
                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/40 px-2 py-1 rounded-lg transition-colors"
                        title="Remove device and all its data"
                      >
                        <Trash2 size={11} /> Remove
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-2 text-xs text-center">
                    {[
                      { icon: <MapPin size={11} />,        val: d._count.locationLogs,      label: 'Locs' },
                      { icon: <Phone size={11} />,         val: d._count.callLogs,          label: 'Calls' },
                      { icon: <MessageSquare size={11} />, val: d._count.smsLogs ?? 0,      label: 'SMS' },
                      { icon: <Bell size={11} />,          val: d._count.notificationLogs,  label: 'Notifs' },
                      { icon: <Globe size={11} />,         val: d._count.browsingHistory,   label: 'URLs' },
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
  const [pinned, setPinned] = useState(recentLocations[0] ?? null);

  const isLatest = pinned?.id === recentLocations[0]?.id;
  const mapsUrl = pinned ? `https://www.google.com/maps?q=${pinned.latitude},${pinned.longitude}` : null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      {/* Map */}
      <div className="xl:col-span-3 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden" style={{ height: 460 }}>
        {!pinned ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-3">
            <MapPin size={48} className="opacity-20" />
            <p className="text-sm">No location data</p>
          </div>
        ) : (
          <iframe
            key={`${pinned.latitude},${pinned.longitude}`}
            title="location-map"
            src={`https://maps.google.com/maps?q=${pinned.latitude},${pinned.longitude}&z=15&output=embed`}
            width="100%" height="100%"
            style={{ border: 0 }}
            allowFullScreen loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </div>

      {/* Right panel */}
      <div className="xl:col-span-2 space-y-4">
        {/* Info card */}
        {pinned && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="font-bold text-white mb-3 flex items-center gap-2 text-sm">
              <MapPin size={16} className="text-indigo-400" />
              {isLatest ? 'Current Location' : 'Selected Location'}
              {!isLatest && (
                <button onClick={() => setPinned(recentLocations[0])}
                  className="ml-auto text-xs text-indigo-400 hover:underline font-normal">
                  ← Back to latest
                </button>
              )}
              {mapsUrl && isLatest && (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                  className="ml-auto text-xs text-indigo-400 hover:underline font-normal">
                  Open in Maps ↗
                </a>
              )}
            </h3>
            <div className="space-y-2.5 text-sm">
              {[
                { label: 'Latitude',  value: pinned.latitude.toFixed(6) },
                { label: 'Longitude', value: pinned.longitude.toFixed(6) },
                { label: 'Accuracy',  value: pinned.accuracy ? `±${Math.round(pinned.accuracy)}m` : '—' },
                { label: 'Address',   value: pinned.address ?? '—' },
                { label: 'Time',      value: new Date(pinned.capturedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-start gap-2">
                  <span className="text-gray-500 flex-shrink-0">{label}</span>
                  <span className="font-medium text-gray-200 text-right break-all">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History list */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="font-bold text-white mb-3 flex items-center gap-2 text-sm">
            <MapPin size={16} className="text-gray-500" /> History
            <span className="ml-auto text-xs text-gray-600 font-normal">Click to view on map</span>
          </h3>
          {recentLocations.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-6">No history available</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {recentLocations.map((l) => {
                const isSelected = pinned?.id === l.id;
                return (
                  <button
                    key={l.id}
                    onClick={() => setPinned(l)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm text-left transition-all
                      ${isSelected
                        ? 'bg-indigo-500/10 border border-indigo-500/30 ring-1 ring-indigo-500/20'
                        : 'bg-gray-800/50 hover:bg-gray-800 border border-transparent'
                      }`}
                  >
                    <MapPin size={14} className={isSelected ? 'text-indigo-400 flex-shrink-0' : 'text-gray-600 flex-shrink-0'} />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-gray-300 truncate">
                        {l.latitude.toFixed(5)}, {l.longitude.toFixed(5)}
                      </p>
                      {l.address && (
                        <p className="text-xs text-gray-500 truncate">{l.address}</p>
                      )}
                      <p className="text-xs text-gray-600">
                        {timeAgo(l.capturedAt)} · {new Date(l.capturedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="flex-shrink-0 w-2 h-2 rounded-full bg-indigo-400" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
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

// ─── Tab: SMS ─────────────────────────────────────────────────────────────────
const SMS_TYPES: Record<number, { label: string; color: string }> = {
  1: { label: 'Inbox',   color: 'bg-green-900/30 text-green-400' },
  2: { label: 'Sent',    color: 'bg-blue-900/30 text-blue-400' },
  3: { label: 'Draft',   color: 'bg-yellow-900/30 text-yellow-400' },
  4: { label: 'Outbox',  color: 'bg-orange-900/30 text-orange-400' },
};

const SMS_PAGE_SIZE = 20;

function SmsTab({ data, userId }: { data: UserDetail; userId: string }) {
  const [search, setSearch] = useState('');
  const [messages, setMessages] = useState<SmsItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage]         = useState(1);

  // Use child device; fall back to first device if no child found
  const deviceId = (data.devices.find((d) => d.role === 'child') ?? data.devices[0])?.deviceId;

  useEffect(() => {
    setPage(1); // reset page on search change
  }, [search]);

  useEffect(() => {
    setLoading(true);
    // Pass no deviceId so backend searches all devices for this user
    adminApi.userSms(userId, 500, undefined, search || undefined)
      .then((r) => setMessages(r.data ?? []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [search, userId, deviceId]);

  const inbox   = messages.filter((m) => m.type === 1).length;
  const sent    = messages.filter((m) => m.type === 2).length;
  const unread  = messages.filter((m) => !m.isRead && m.type === 1).length;
  const totalPages = Math.max(1, Math.ceil(messages.length / SMS_PAGE_SIZE));
  const paginated  = messages.slice((page - 1) * SMS_PAGE_SIZE, page * SMS_PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Inbox',  value: inbox,  color: 'text-green-400 bg-green-900/20 border-green-800/40' },
          { label: 'Sent',   value: sent,   color: 'text-blue-400 bg-blue-900/20 border-blue-800/40' },
          { label: 'Unread', value: unread, color: 'text-yellow-400 bg-yellow-900/20 border-yellow-800/40' },
        ].map((s) => (
          <div key={s.label} className={`border rounded-2xl p-4 ${s.color}`}>
            <p className="text-2xl font-extrabold">{s.value}</p>
            <p className="text-xs mt-0.5 opacity-70">{s.label}</p>
          </div>
        ))}
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <SectionHeader icon={<MessageSquare size={18} />} title="SMS Messages" count={messages.length} />
          <div className="ml-auto relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search number or message…"
              className="bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-52" />
          </div>
        </div>

        {loading ? (
          <PageLoader theme="dark" />
        ) : messages.length === 0 ? (
          <Empty msg={search ? 'No messages match your search' : 'No SMS messages captured yet'} />
        ) : (
          <>
            <div className="space-y-2">
              {paginated.map((m) => {
                const typeInfo = SMS_TYPES[m.type] ?? { label: 'Other', color: 'bg-gray-800 text-gray-400' };
                const isOpen   = expanded === m.id;
                return (
                  <div key={m.id}
                    onClick={() => setExpanded(isOpen ? null : m.id)}
                    className="bg-gray-800/40 hover:bg-gray-800/70 border border-gray-700/50 rounded-xl px-4 py-3 cursor-pointer transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-indigo-700/40 rounded-xl flex items-center justify-center flex-shrink-0">
                        <MessageSquare size={14} className="text-indigo-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-semibold truncate">{m.address || 'Unknown'}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                          {!m.isRead && m.type === 1 && (
                            <span className="w-2 h-2 bg-yellow-400 rounded-full flex-shrink-0" />
                          )}
                        </div>
                        <p className={`text-xs text-gray-400 mt-0.5 ${isOpen ? '' : 'truncate'}`}>
                          {m.body || <span className="italic text-gray-600">Empty message</span>}
                        </p>
                      </div>
                      <span className="text-xs text-gray-600 flex-shrink-0 whitespace-nowrap">
                        {timeAgo(m.date)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                <span className="text-xs text-gray-500">
                  Page {page} of {totalPages} · {messages.length} total
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 rounded-lg transition-colors">
                    ← Prev
                  </button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 rounded-lg transition-colors">
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
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
          isVideoUrl(item.imageUrl) ? (
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
                className="max-w-full max-h-full object-contain rounded-lg select-none"
                style={{ maxHeight: 'calc(100vh - 160px)' }}
              />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 text-gray-300 text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
                <Video size={12} /> Video preview — full file uploading in background
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
const BROWSER_LABELS: Record<string, string> = {
  'com.android.chrome':            'Chrome',
  'com.chrome.beta':               'Chrome Beta',
  'com.chrome.dev':                'Chrome Dev',
  'com.chrome.canary':             'Chrome Canary',
  'org.mozilla.firefox':           'Firefox',
  'org.mozilla.firefox_beta':      'Firefox Beta',
  'org.mozilla.fenix':             'Firefox',
  'org.mozilla.fennec_aurora':     'Firefox Aurora',
  'com.brave.browser':             'Brave',
  'com.microsoft.emmx':            'Edge',
  'com.opera.browser':             'Opera',
  'com.opera.mini.native':         'Opera Mini',
  'com.sec.android.app.sbrowser':  'Samsung Browser',
  'com.duckduckgo.mobile.android': 'DuckDuckGo',
  'com.kiwibrowser.browser':       'Kiwi',
  'com.vivaldi.browser':           'Vivaldi',
  'com.android.browser':           'Browser',
};

const BROWSER_COLORS: Record<string, string> = {
  'Chrome':          'text-yellow-400 bg-yellow-900/20',
  'Chrome Beta':     'text-yellow-400 bg-yellow-900/20',
  'Firefox':         'text-orange-400 bg-orange-900/20',
  'Brave':           'text-orange-300 bg-orange-900/20',
  'Edge':            'text-blue-400 bg-blue-900/20',
  'Opera':           'text-red-400 bg-red-900/20',
  'Opera Mini':      'text-red-400 bg-red-900/20',
  'Samsung Browser': 'text-blue-300 bg-blue-900/20',
  'DuckDuckGo':      'text-green-400 bg-green-900/20',
};

function browserLabel(pkg: string | null): string {
  if (!pkg) return 'Browser';
  return BROWSER_LABELS[pkg] ?? pkg.split('.').pop() ?? 'Browser';
}
function browserColor(name: string): string {
  return BROWSER_COLORS[name] ?? 'text-indigo-400 bg-indigo-900/20';
}

function BrowsingTab({ data }: { data: UserDetail }) {
  const { browsingHistory } = data;
  const [browser, setBrowser] = useState('__all__');
  const [search, setSearch]   = useState('');

  // Build browser → entries map
  const browserMap = browsingHistory.reduce<Record<string, typeof browsingHistory>>((acc, b) => {
    const name = browserLabel(b.browserApp ?? null);
    (acc[name] ??= []).push(b);
    return acc;
  }, {});
  const browsers = Object.entries(browserMap).sort((a, b) => b[1].length - a[1].length);

  const base    = browser === '__all__' ? browsingHistory : (browserMap[browser] ?? []);
  const q       = search.toLowerCase();
  const visible = q
    ? base.filter((b) => b.url.toLowerCase().includes(q) || (b.title ?? '').toLowerCase().includes(q))
    : base;

  // Unique domains in visible set
  const uniqueDomains = new Set(visible.map((b) => { try { return new URL(b.url).hostname; } catch { return b.url; } })).size;

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Visits',    value: browsingHistory.length },
          { label: 'Unique Domains',  value: uniqueDomains },
          { label: 'Browsers',        value: browsers.length },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
            <p className="text-2xl font-extrabold text-white">{s.value}</p>
            <p className="text-gray-400 text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-5">
        {/* Browser sidebar */}
        <div className="flex-shrink-0 w-44">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2 px-1">Browsers</p>
          <div className="space-y-1">
            <button
              onClick={() => setBrowser('__all__')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors ${browser === '__all__' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Globe size={13} className="flex-shrink-0" />
                <span className="truncate">All Browsers</span>
              </span>
              <span className={`text-xs flex-shrink-0 ml-1 ${browser === '__all__' ? 'text-indigo-200' : 'text-gray-600'}`}>{browsingHistory.length}</span>
            </button>
            {browsers.map(([name, items]) => (
              <button
                key={name}
                onClick={() => setBrowser(name)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors ${browser === name ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${browserColor(name)}`}>
                    {name.charAt(0)}
                  </span>
                  <span className="truncate">{name}</span>
                </span>
                <span className={`text-xs flex-shrink-0 ml-1 ${browser === name ? 'text-indigo-200' : 'text-gray-600'}`}>{items.length}</span>
              </button>
            ))}
          </div>
        </div>

        {/* History list */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold text-sm">
              {browser === '__all__' ? 'All Browsers' : browser}
              <span className="text-gray-500 font-normal ml-2 text-xs">{visible.length} visits</span>
            </h3>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search URLs…"
                className="bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-44" />
            </div>
          </div>

          <Card className="overflow-hidden">
            {visible.length === 0 ? <div className="p-6"><Empty msg="No history found" /></div> : (
              <div className="divide-y divide-gray-800/50 max-h-[600px] overflow-y-auto">
                {visible.map((b) => {
                  let domain = '';
                  try { domain = new URL(b.url).hostname; } catch {}
                  const bName  = browserLabel(b.browserApp ?? null);
                  const bColor = browserColor(bName);
                  return (
                    <div key={b.id} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-800/30 transition-colors">
                      <div className="w-7 h-7 bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Globe size={13} className="text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{b.title ?? domain}</p>
                        <p className="text-gray-500 text-xs truncate">{b.url}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${bColor}`}>{bName}</span>
                          {(b.visitCount ?? 1) > 1 && (
                            <span className="text-gray-600 text-[10px]">{b.visitCount}× visits</span>
                          )}
                        </div>
                      </div>
                      <span className="text-gray-600 text-xs whitespace-nowrap ml-2 flex-shrink-0">{timeAgo(b.visitedAt)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Types for Remote tab ─────────────────────────────────────────────────────
interface RemoteCommand { id: string; commandType: string; payload: string; status: string; result: string | null; issuedAt: string; completedAt: string | null; }

// ─── Command result viewer ────────────────────────────────────────────────────
function CommandResult({ raw }: { raw: string | null }) {
  if (!raw) return <span className="text-gray-600">—</span>;

  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(raw); }
  catch { return <span className="text-gray-400 text-xs font-mono">{raw.slice(0, 80)}</span>; }

  const type = parsed.type as string | undefined;

  // ── Photo ──────────────────────────────────────────────────────────────────
  if (type === 'photo' && parsed.data) {
    const src = `data:${parsed.mimeType ?? 'image/jpeg'};base64,${parsed.data}`;
    return (
      <div className="mt-2 space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Captured" className="max-w-sm rounded-lg border border-gray-700" />
        <a
          href={src}
          download={`photo_${Date.now()}.jpg`}
          className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
        >
          ↓ Download photo
        </a>
      </div>
    );
  }

  // ── Audio ──────────────────────────────────────────────────────────────────
  if (type === 'audio' && parsed.data) {
    const src = `data:${parsed.mimeType ?? 'audio/mp4'};base64,${parsed.data}`;
    const dur = parsed.duration as number | undefined;
    return (
      <div className="mt-2 space-y-2">
        <audio controls src={src} className="w-full max-w-sm" />
        {dur != null && <p className="text-xs text-gray-500">Duration: {dur}s</p>}
        <a
          href={src}
          download={`audio_${Date.now()}.m4a`}
          className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
        >
          ↓ Download audio
        </a>
      </div>
    );
  }

  // ── File list ──────────────────────────────────────────────────────────────
  if (type === 'files') {
    const entries = (parsed.entries as Array<{ name: string; size: number; isDir: boolean; modified: number }>) ?? [];
    return (
      <div className="mt-2 max-h-48 overflow-y-auto space-y-0.5">
        {entries.map((f, i) => (
          <div key={i} className="flex items-center gap-2 text-xs py-0.5">
            <span className="text-gray-500">{f.isDir ? '📁' : '📄'}</span>
            <span className="text-white flex-1 truncate">{f.name}</span>
            {!f.isDir && <span className="text-gray-600">{fmtBytes(f.size)}</span>}
          </div>
        ))}
        {entries.length === 0 && <span className="text-gray-500 text-xs">Empty</span>}
      </div>
    );
  }

  // ── Status / error / generic ───────────────────────────────────────────────
  const msg = (parsed.message ?? parsed.error ?? parsed.status) as string | undefined;
  const color = type === 'error' ? 'text-red-400' : 'text-green-400';
  return <span className={`text-xs ${color}`}>{msg ?? JSON.stringify(parsed).slice(0, 120)}</span>;
}
interface Geofence { id: string; name: string; latitude: number; longitude: number; radiusM: number; isActive: boolean; createdAt: string; }
interface AppBlockRule { id: string; packageName: string; appName: string; isBlocked: boolean; createdAt: string; }

// ─── Command row (expandable) ─────────────────────────────────────────────────
function CommandRow({ command: c }: { command: RemoteCommand }) {
  const [open, setOpen] = useState(false);
  const hasResult = !!c.result;
  const completedDate = c.completedAt ? new Date(c.completedAt) : null;

  return (
    <div className="bg-gray-800/50 rounded-xl overflow-hidden">
      <button
        onClick={() => hasResult && setOpen((o) => !o)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${hasResult ? 'hover:bg-gray-800 cursor-pointer' : 'cursor-default'}`}
      >
        {/* Command name */}
        <span className="text-white text-xs font-mono font-semibold flex-1">
          {c.commandType}
        </span>

        {/* Status badge */}
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${STATUS_COLOR[c.status] ?? 'text-gray-400 bg-gray-700'}`}>
          {c.status}
        </span>

        {/* Issued at */}
        <span className="text-gray-500 text-xs whitespace-nowrap">
          {new Date(c.issuedAt).toLocaleString()}
        </span>

        {/* Completed at */}
        {completedDate && (
          <span className="text-gray-600 text-xs whitespace-nowrap">
            ✓ {completedDate.toLocaleTimeString()}
          </span>
        )}

        {/* Expand indicator */}
        {hasResult && (
          <span className="text-indigo-400 text-xs ml-1">{open ? '▲' : '▼'}</span>
        )}
        {!hasResult && c.status === 'pending' && (
          <span className="text-yellow-400 text-xs">waiting…</span>
        )}
      </button>

      {/* Result panel */}
      {open && hasResult && (
        <div className="border-t border-gray-700 px-4 pb-4">
          <CommandResult raw={c.result} />
        </div>
      )}
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  pending:   'text-yellow-400 bg-yellow-900/30',
  delivered: 'text-blue-400 bg-blue-900/30',
  executing: 'text-indigo-400 bg-indigo-900/30',
  completed: 'text-green-400 bg-green-900/30',
  failed:    'text-red-400 bg-red-900/30',
  cancelled: 'text-gray-500 bg-gray-800',
};

// ─── Tab: Remote Access (card hub — each card opens its own page) ─────────────
function RemoteTab({ data, userId, selectedDeviceId, allDevices }: {
  data: UserDetail; userId: string;
  selectedDeviceId: string | null; allDevices: Device[];
}) {
  const router = useRouter();

  // Use the currently selected device from the top-level device selector
  const device = selectedDeviceId
    ? allDevices.find((d) => d.deviceId === selectedDeviceId) ?? null
    : allDevices.filter((d) => d.role === 'child')[0] ?? null;

  const CARDS = [
    { key: 'camera',     label: 'Camera Capture',  desc: 'Silently capture photo from front or back camera',         icon: <Camera size={22} className="text-pink-400" />,     iconBg: 'bg-pink-500/20',    border: 'hover:border-pink-700/50',    accent: 'from-pink-600 to-rose-700' },
    { key: 'audio',      label: 'Audio Recording', desc: 'Start / stop ambient microphone recording',               icon: <Mic size={22} className="text-red-400" />,         iconBg: 'bg-red-500/20',     border: 'hover:border-red-700/50',     accent: 'from-red-600 to-orange-700' },
    { key: 'screenshot', label: 'Screenshot',      desc: 'Capture current screen via Accessibility Service (API 30+)', icon: <Monitor size={22} className="text-cyan-400" />,    iconBg: 'bg-cyan-500/20',    border: 'hover:border-cyan-700/50',    accent: 'from-cyan-600 to-teal-700' },
    { key: 'files',      label: 'File Browsing',   desc: 'List files and folders on device storage',                icon: <FolderOpen size={22} className="text-yellow-400" />,iconBg: 'bg-yellow-500/20',  border: 'hover:border-yellow-700/50',  accent: 'from-yellow-600 to-amber-700' },
    { key: 'apps',       label: 'Installed Apps',  desc: 'List all user-installed apps on the device',              icon: <AppWindow size={22} className="text-emerald-400" />,iconBg: 'bg-emerald-500/20', border: 'hover:border-emerald-700/50', accent: 'from-emerald-600 to-green-700' },
    { key: 'quick',      label: 'Quick Commands',  desc: 'Lock device, block or unblock apps instantly',            icon: <Shield size={22} className="text-indigo-400" />,   iconBg: 'bg-indigo-500/20',  border: 'hover:border-indigo-700/50',  accent: 'from-indigo-600 to-violet-700' },
  ];

  if (!device) {
    return <Empty msg="No child devices registered for this user" />;
  }

  return (
    <div className="space-y-5">
      {/* Device badge */}
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${device.isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
        <span className="text-white font-semibold text-sm">{device.name}</span>
        <span className={`text-xs font-medium ${device.isOnline ? 'text-green-400' : 'text-gray-500'}`}>
          {device.isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {!device.isOnline && (
        <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl px-4 py-2.5 text-yellow-300 text-xs flex items-center gap-2">
          <WifiOff size={13} /> Offline — commands will queue and execute when device reconnects.
        </div>
      )}

      <p className="text-gray-500 text-sm">
        Select a category to open its dedicated page — send commands and view results in real time.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARDS.map((card) => (
          <button
            key={card.key}
            onClick={() => router.push(`/admin/users/${userId}/remote/${device.deviceId}/${card.key}`)}
            className={`group relative bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50 ${card.border} rounded-2xl p-5 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0`}
          >
            <div className={`absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-gradient-to-r ${card.accent} opacity-0 group-hover:opacity-100 transition-opacity`} />
            <div className="flex items-start justify-between gap-3">
              <div className={`w-11 h-11 ${card.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                {card.icon}
              </div>
              <ChevronRight size={16} className="text-gray-600 group-hover:text-gray-400 transition-colors mt-1.5 flex-shrink-0" />
            </div>
            <div className="mt-3">
              <h4 className="text-white font-bold text-sm">{card.label}</h4>
              <p className="text-gray-500 text-xs mt-1 leading-relaxed">{card.desc}</p>
            </div>
          </button>
        ))}
      </div>
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
  const [contentVisible, setContentVisible] = useState(true);

  function switchTab(key: Tab) {
    if (key === tab) return;
    setContentVisible(false);
    setTimeout(() => { setTab(key); setContentVisible(true); }, 130);
  }
  const [deleting, setDeleting]           = useState(false);

  const fetchData = useCallback((devId?: string | null) => {
    setLoading(true);
    adminApi.userDetail(userId, devId ?? undefined)
      .then((r) => {
        setData(r.data);
        if (!devId) setAllDevices(r.data.devices ?? []);
      })
      .catch(() => router.push('/admin/users'))
      .finally(() => setLoading(false));
  }, [userId, router]);

  // Auto-refresh when FCM signals new data for this user
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ userId: string }>).detail;
      if (detail?.userId === userId) fetchData(selectedDeviceId);
    };
    window.addEventListener('pm:new-data', handler);
    return () => window.removeEventListener('pm:new-data', handler);
  }, [userId, selectedDeviceId, fetchData]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeviceSelect = useCallback((devId: string | null) => {
    setSelectedDeviceId(devId);
    fetchData(devId);
  }, [fetchData]);

  const handleDeviceDelete = useCallback(async (deviceId: string, name: string) => {
    const step1 = await confirmDialog({
      title: `Delete data for "${name}"?`,
      text: 'This permanently removes all locations, SMS, calls, notifications, gallery, browsing history and more for this device.',
      confirmText: 'Yes, delete data',
      type: 'danger', theme: 'dark',
    });
    if (!step1) return;
    try {
      await adminApi.deleteDeviceData(deviceId);
      toast.success(`All data for "${name}" deleted`);
      const step2 = await stepConfirm({
        title: 'Data deleted!',
        text: `All monitoring data for "${name}" has been removed. Remove the device registration too?`,
        confirmText: 'Yes, remove device',
        cancelText: 'Keep device',
        theme: 'dark',
      });
      if (step2) {
        await adminApi.deleteDevice(deviceId);
        if (selectedDeviceId === deviceId) setSelectedDeviceId(null);
        setAllDevices((prev) => prev.filter((d) => d.deviceId !== deviceId));
        fetchData(selectedDeviceId === deviceId ? null : selectedDeviceId);
        toast.success(`Device "${name}" removed`);
      } else {
        fetchData(selectedDeviceId);
      }
    } catch {
      toast.error(`Failed to delete data for "${name}"`);
    }
  }, [selectedDeviceId, fetchData]);

  const handleDelete = useCallback(async () => {
    const step1 = await confirmDialog({
      title: 'Delete all user data?',
      text: 'This permanently removes all locations, SMS, calls, notifications, gallery, browsing history, and more for this user.',
      confirmText: 'Yes, delete data',
      type: 'danger', theme: 'dark',
    });
    if (!step1) return;
    setDeleting(true);
    try {
      await adminApi.deleteUserData(userId);
      toast.success('All user data deleted');
      const step2 = await stepConfirm({
        title: 'Data deleted!',
        text: 'All monitoring data has been removed. Delete the user account too?',
        confirmText: 'Yes, delete account',
        cancelText: 'Keep account',
        theme: 'dark',
      });
      if (!step2) { setDeleting(false); fetchData(null); return; }
      await adminApi.deleteUser(userId);
      toast.success('User account deleted');
      router.push('/admin/users');
    } finally {
      setDeleting(false);
    }
  }, [userId, router]);

  if (loading && !data) {
    return <div className="flex-1"><PageLoader theme="dark" /></div>;
  }

  if (!data) return null;

  const { user } = data;
  const devices = allDevices;
  const selectedDevice = selectedDeviceId ? devices.find((d) => d.deviceId === selectedDeviceId) : null;

  const totalRecords = devices.reduce((s, d) =>
    s + d._count.locationLogs + d._count.notificationLogs + d._count.appUsageLogs +
    d._count.callLogs + (d._count.smsLogs ?? 0) + d._count.contacts + d._count.galleryItems + d._count.browsingHistory, 0
  );

  const tabContent: Record<Tab, React.ReactNode> = {
    overview:      <OverviewTab data={data} onDeviceDelete={handleDeviceDelete} />,
    location:      <LocationTab data={data} />,
    calls:         <CallsTab data={data} />,
    sms:           <SmsTab data={data} userId={userId} />,
    contacts:      <ContactsTab data={data} />,
    gallery:       <GalleryTab data={data} />,
    notifications: <NotificationsTab data={data} />,
    usage:         <UsageTab data={data} />,
    browsing:      <BrowsingTab data={data} />,
    remote:        <RemoteTab data={data} userId={userId} selectedDeviceId={selectedDeviceId} allDevices={allDevices} />,
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top header */}
      <div className="px-8 pt-8 pb-5 border-b border-gray-800/60 space-y-4">
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

      </div>

      {/* Body: vertical nav + content */}
      <div className="flex-1 flex min-h-0">

        {/* ── Left vertical navigation ── */}
        <nav className="w-56 flex-shrink-0 border-r border-gray-800/50 bg-gray-950/30 py-5 overflow-y-auto">
          {NAV_GROUPS.map(({ label, keys }) => {
            const groupTabs = keys.map((k) => TABS.find((t) => t.key === k)!);
            return (
              <div key={label} className="mb-5">
                <p className="text-[10px] font-bold tracking-widest uppercase text-gray-600 px-4 mb-1.5 select-none">
                  {label}
                </p>
                {groupTabs.map((t) => {
                  const active = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => switchTab(t.key)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 relative group
                        transition-all duration-150 ease-out
                        ${active ? 'text-white' : 'text-gray-500 hover:text-gray-200'}`}
                    >
                      {/* Animated left border indicator */}
                      <span
                        className={`absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full transition-all duration-200
                          ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-20'}`}
                        style={{ backgroundColor: t.color }}
                      />

                      {/* Hover background */}
                      <span className={`absolute inset-x-2 inset-y-0.5 rounded-xl transition-all duration-150
                        ${active ? 'bg-gray-800/80' : 'bg-transparent group-hover:bg-gray-800/40'}`} />

                      {/* Colored icon box */}
                      <span className={`relative z-10 w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200
                        ${active
                          ? `bg-gradient-to-br ${t.gradient} shadow-lg`
                          : 'bg-gray-800 group-hover:bg-gray-750'}`}>
                        <t.Icon size={15} className={active ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'} />
                      </span>

                      <span className="relative z-10 text-xs font-semibold flex-1 text-left">{t.label}</span>

                      {active && (
                        <ChevronRight size={12} className="relative z-10 text-gray-500 mr-1 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* ── Content area ── */}
        <div
          className="flex-1 p-7 overflow-y-auto"
          style={{ opacity: contentVisible ? 1 : 0, transition: 'opacity 0.13s ease' }}
        >
          {tabContent[tab]}
        </div>

      </div>
    </div>
  );
}
