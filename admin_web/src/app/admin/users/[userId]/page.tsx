'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, User, Mail, Calendar, Smartphone, MapPin,
  Bell, BarChart2, Wifi, WifiOff, Clock,
} from 'lucide-react';
import { adminApi } from '@/lib/adminApi';

interface DeviceCount { locationLogs: number; appUsageLogs: number; notificationLogs: number; statusLogs: number; }
interface Device { id: string; deviceId: string; name: string; role: string; isOnline: boolean; lastSeen: string | null; registeredAt: string; _count: DeviceCount; }
interface LocationLog { id: string; deviceId: string; latitude: number; longitude: number; accuracy: number | null; address: string | null; capturedAt: string; }
interface NotificationLog { id: string; deviceId: string; appName: string; title: string | null; body: string | null; postedAt: string; }
interface UsageLog { id: string; deviceId: string; appName: string; packageName: string; usageDurationMs: string; capturedAt: string; }

interface UserDetail {
  user: { id: string; name: string; email: string; role: string; createdAt: string; };
  devices: Device[];
  recentLocations: LocationLog[];
  recentNotifications: NotificationLog[];
  recentUsage: UsageLog[];
}

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

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h3 className="text-white font-bold mb-5 flex items-center gap-2">
        <span className="text-indigo-400">{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const [data, setData]     = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.userDetail(userId)
      .then((r) => setData(r.data))
      .catch(() => router.push('/admin/users'))
      .finally(() => setLoading(false));
  }, [userId, router]);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data) return null;
  const { user, devices, recentLocations, recentNotifications, recentUsage } = data;

  const totalLogs = devices.reduce((s, d) => s + d._count.locationLogs + d._count.appUsageLogs + d._count.notificationLogs, 0);

  return (
    <div className="flex-1 p-8 space-y-6">
      {/* Back + Header */}
      <div>
        <button onClick={() => router.push('/admin/users')}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors">
          <ArrowLeft size={16} /> Back to Users
        </button>
        <div className="flex items-start justify-between border-b border-gray-800 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-700 rounded-2xl flex items-center justify-center text-white font-bold text-xl">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">{user.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-gray-400 text-sm flex items-center gap-1">
                  <Mail size={13} /> {user.email}
                </span>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize
                  ${user.role === 'parent' ? 'bg-blue-900/40 text-blue-300' : 'bg-purple-900/40 text-purple-300'}`}>
                  {user.role}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-gray-500 text-xs flex items-center gap-1 justify-end">
              <Calendar size={12} /> Joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <p className="text-gray-500 text-xs mt-1">{totalLogs.toLocaleString()} total data records</p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Devices',       value: devices.length,   icon: <Smartphone size={18} className="text-blue-400" />,   bg: 'bg-blue-600/10 border-blue-800/40' },
          { label: 'Location Logs', value: devices.reduce((s, d) => s + d._count.locationLogs, 0), icon: <MapPin size={18} className="text-orange-400" />, bg: 'bg-orange-600/10 border-orange-800/40' },
          { label: 'Notifications', value: devices.reduce((s, d) => s + d._count.notificationLogs, 0), icon: <Bell size={18} className="text-red-400" />, bg: 'bg-red-600/10 border-red-800/40' },
          { label: 'Usage Records', value: devices.reduce((s, d) => s + d._count.appUsageLogs, 0), icon: <BarChart2 size={18} className="text-purple-400" />, bg: 'bg-purple-600/10 border-purple-800/40' },
        ].map((s) => (
          <div key={s.label} className={`border rounded-2xl p-4 ${s.bg}`}>
            <div className="mb-2">{s.icon}</div>
            <p className="text-2xl font-extrabold text-white">{s.value.toLocaleString()}</p>
            <p className="text-gray-400 text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Devices */}
      <Section title="Registered Devices" icon={<Smartphone size={18} />}>
        {devices.length === 0 ? (
          <p className="text-gray-500 text-sm">No devices registered</p>
        ) : (
          <div className="space-y-3">
            {devices.map((d) => (
              <div key={d.id} className="flex items-center justify-between bg-gray-800/50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center">
                    <Smartphone size={18} className="text-gray-300" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{d.name}</p>
                    <p className="text-gray-500 text-xs font-mono">{d.deviceId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="capitalize bg-gray-700 px-2 py-0.5 rounded-full">{d.role}</span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {timeAgo(d.lastSeen)}
                  </span>
                  {d.isOnline
                    ? <span className="flex items-center gap-1 text-green-400"><Wifi size={12} /> Online</span>
                    : <span className="flex items-center gap-1 text-gray-500"><WifiOff size={12} /> Offline</span>}
                  <div className="flex gap-2 text-gray-500">
                    <span title="Locations"><MapPin size={12} className="inline" /> {d._count.locationLogs}</span>
                    <span title="Notifications"><Bell size={12} className="inline" /> {d._count.notificationLogs}</span>
                    <span title="App usage"><BarChart2 size={12} className="inline" /> {d._count.appUsageLogs}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent locations */}
        <Section title="Recent Locations" icon={<MapPin size={18} />}>
          {recentLocations.length === 0 ? <p className="text-gray-500 text-sm">No locations yet</p> : (
            <div className="space-y-2">
              {recentLocations.map((l) => (
                <div key={l.id} className="bg-gray-800/50 rounded-xl px-3 py-2.5">
                  <p className="text-white text-xs font-mono">{l.latitude.toFixed(4)}, {l.longitude.toFixed(4)}</p>
                  {l.address && <p className="text-gray-400 text-xs mt-0.5 truncate">{l.address}</p>}
                  <p className="text-gray-600 text-xs mt-0.5">{timeAgo(l.capturedAt)}</p>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Recent notifications */}
        <Section title="Recent Notifications" icon={<Bell size={18} />}>
          {recentNotifications.length === 0 ? <p className="text-gray-500 text-sm">No notifications yet</p> : (
            <div className="space-y-2">
              {recentNotifications.map((n) => (
                <div key={n.id} className="bg-gray-800/50 rounded-xl px-3 py-2.5">
                  <p className="text-indigo-300 text-xs font-semibold">{n.appName}</p>
                  {n.title && <p className="text-white text-xs mt-0.5">{n.title}</p>}
                  {n.body && <p className="text-gray-400 text-xs truncate">{n.body}</p>}
                  <p className="text-gray-600 text-xs mt-0.5">{timeAgo(n.postedAt)}</p>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Recent app usage */}
        <Section title="Recent App Usage" icon={<BarChart2 size={18} />}>
          {recentUsage.length === 0 ? <p className="text-gray-500 text-sm">No usage data yet</p> : (
            <div className="space-y-2">
              {recentUsage.map((u) => (
                <div key={u.id} className="flex items-center justify-between bg-gray-800/50 rounded-xl px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-white text-xs font-semibold truncate">{u.appName}</p>
                    <p className="text-gray-600 text-xs">{timeAgo(u.capturedAt)}</p>
                  </div>
                  <span className="text-indigo-300 text-xs font-bold ml-2 flex-shrink-0">
                    {msToHm(Number(u.usageDurationMs))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
