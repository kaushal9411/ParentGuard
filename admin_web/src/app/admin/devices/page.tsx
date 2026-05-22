'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Smartphone, Wifi, WifiOff, Clock, Trash2,
  MapPin, Bell, Phone, Globe, Image, Contact,
  ChevronDown, ChevronUp, Search,
} from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import PageLoader from '@/components/PageLoader';
import { confirmDialog, stepConfirm } from '@/lib/confirm';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeviceCount {
  locationLogs: number;
  notificationLogs: number;
  callLogs: number;
  galleryItems: number;
  browsingHistory: number;
  contacts: number;
}

interface Device {
  id: string;
  deviceId: string;
  name: string;
  role: string;
  isOnline: boolean;
  lastSeen: string | null;
  ipAddress: string | null;
  registeredAt: string;
  _count: DeviceCount;
}

interface UserWithDevices {
  id: string;
  name: string;
  email: string;
  role: string;
  devices: Device[];
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

function totalRecords(d: Device): number {
  const c = d._count;
  return c.locationLogs + c.notificationLogs + c.callLogs +
         c.galleryItems + c.browsingHistory + c.contacts;
}

// ─── Device card ──────────────────────────────────────────────────────────────

function DeviceCard({
  device,
  userName,
  userId,
  onRemove,
  removing,
}: {
  device: Device;
  userName: string;
  userId: string;
  onRemove: () => void;
  removing: boolean;
}) {
  const router = useRouter();

  const stats = [
    { icon: <MapPin size={11} />,  label: 'Locations',     val: device._count.locationLogs },
    { icon: <Bell size={11} />,    label: 'Notifications', val: device._count.notificationLogs },
    { icon: <Phone size={11} />,   label: 'Calls',         val: device._count.callLogs },
    { icon: <Image size={11} />,   label: 'Gallery',       val: device._count.galleryItems },
    { icon: <Globe size={11} />,   label: 'URLs',          val: device._count.browsingHistory },
    { icon: <Contact size={11} />, label: 'Contacts',      val: device._count.contacts },
  ];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-indigo-700/30 rounded-xl flex items-center justify-center flex-shrink-0">
            <Smartphone size={18} className="text-indigo-400" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm truncate">{device.name}</p>
            <p className="text-gray-500 text-xs font-mono truncate">{device.deviceId}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {device.isOnline
            ? <span className="flex items-center gap-1 text-green-400 text-xs font-semibold"><Wifi size={11} /> Online</span>
            : <span className="flex items-center gap-1 text-gray-500 text-xs"><WifiOff size={11} /> Offline</span>}
          <span className="text-xs capitalize bg-gray-800 px-2 py-0.5 rounded-full text-gray-400">{device.role}</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-gray-800/60 rounded-xl p-2 text-center">
            <div className="flex justify-center text-gray-500 mb-0.5">{s.icon}</div>
            <p className="text-white text-xs font-bold">{s.val.toLocaleString()}</p>
            <p className="text-gray-600 text-[10px]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-800">
        <div className="text-xs text-gray-500 space-y-0.5">
          <p className="flex items-center gap-1">
            <Clock size={10} /> Last seen: {timeAgo(device.lastSeen)}
          </p>
          {device.ipAddress && <p className="font-mono">IP: {device.ipAddress}</p>}
          <p className="text-gray-600">
            {totalRecords(device).toLocaleString()} total records
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => router.push(`/admin/users/${userId}`)}
            className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-900/20 hover:bg-indigo-900/40 px-3 py-1.5 rounded-lg transition-colors"
          >
            View Data
          </button>
          <button
            onClick={onRemove}
            disabled={removing}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/40 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {removing
              ? <span className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
              : <Trash2 size={11} />}
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── User group ───────────────────────────────────────────────────────────────

function UserGroup({
  user,
  onRemoveDevice,
  removingId,
}: {
  user: UserWithDevices;
  onRemoveDevice: (deviceId: string, deviceName: string) => void;
  removingId: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const router = useRouter();

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* User header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-800/50 transition-colors"
      >
        <div className="w-10 h-10 bg-indigo-700 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-white font-bold text-sm truncate">{user.name}</p>
          <p className="text-gray-500 text-xs truncate">{user.email}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
            {user.devices.length} device{user.devices.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/admin/users/${user.id}`); }}
            className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-0.5 rounded transition-colors"
          >
            View User →
          </button>
          {expanded
            ? <ChevronUp size={16} className="text-gray-500" />
            : <ChevronDown size={16} className="text-gray-500" />}
        </div>
      </button>

      {/* Devices grid */}
      {expanded && (
        <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 border-t border-gray-800 pt-4">
          {user.devices.map((d) => (
            <DeviceCard
              key={d.id}
              device={d}
              userName={user.name}
              userId={user.id}
              onRemove={() => onRemoveDevice(d.deviceId, d.name)}
              removing={removingId === d.deviceId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DevicesPage() {
  const [users, setUsers]       = useState<UserWithDevices[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.allDevices();
      setUsers(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRemoveDevice = useCallback(async (deviceId: string, deviceName: string) => {
    const step1 = await confirmDialog({
      title: `Delete data for "${deviceName}"?`,
      text: 'This permanently removes all location logs, call logs, gallery, browsing history, SMS, and notifications for this device.',
      confirmText: 'Yes, delete data',
      type: 'danger', theme: 'dark',
    });
    if (!step1) return;
    setRemovingId(deviceId);
    try {
      await adminApi.deleteDeviceData(deviceId);
      toast.success(`All data for "${deviceName}" deleted`);
      const step2 = await stepConfirm({
        title: 'Data deleted!',
        text: `All data for "${deviceName}" has been removed. Remove the device registration too?`,
        confirmText: 'Yes, remove device',
        cancelText: 'Keep device',
        theme: 'dark',
      });
      if (step2) {
        await adminApi.deleteDevice(deviceId);
        setUsers((prev) =>
          prev
            .map((u) => ({ ...u, devices: u.devices.filter((d) => d.deviceId !== deviceId) }))
            .filter((u) => u.devices.length > 0),
        );
        toast.success(`Device "${deviceName}" removed`);
      }
    } catch {
      toast.error(`Failed to delete data for "${deviceName}"`);
    } finally {
      setRemovingId(null);
    }
  }, []);

  // Filter by search (user name, email, device name, deviceId)
  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    if (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) return true;
    return u.devices.some((d) =>
      d.name.toLowerCase().includes(q) || d.deviceId.toLowerCase().includes(q),
    );
  });

  const totalDevices = filtered.reduce((s, u) => s + u.devices.length, 0);
  const onlineCount  = filtered.reduce(
    (s, u) => s + u.devices.filter((d) => d.isOnline).length, 0,
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Devices</h1>
            <p className="text-gray-500 text-sm mt-0.5">All registered devices grouped by user</p>
          </div>
          <button
            onClick={load}
            className="text-xs text-gray-500 hover:text-white border border-gray-700 hover:border-gray-600 px-3 py-1.5 rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 text-sm">
          <span className="text-gray-400">
            <span className="text-white font-bold">{totalDevices}</span> device{totalDevices !== 1 ? 's' : ''}
          </span>
          <span className="text-gray-400">
            <span className="text-green-400 font-bold">{onlineCount}</span> online
          </span>
          <span className="text-gray-400">
            <span className="text-white font-bold">{filtered.length}</span> user{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user name, email or device…"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {loading ? (
          <PageLoader theme="dark" />
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-500 py-16">
            <Smartphone size={40} className="mx-auto mb-3 opacity-30" />
            <p>{search ? 'No devices match your search' : 'No devices registered yet'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((u) => (
              <UserGroup
                key={u.id}
                user={u}
                onRemoveDevice={handleRemoveDevice}
                removingId={removingId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
