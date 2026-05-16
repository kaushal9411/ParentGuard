'use client';
import { useEffect, useState } from 'react';
import { Smartphone, Wifi, MapPin, Bell, TrendingUp, Clock, Battery, Activity } from 'lucide-react';
import Header from '@/components/Header';
import { devicesApi, locationApi, notificationsApi } from '@/lib/api';
import type { Device, LocationLog, NotificationLog } from '@/types';

interface Stat { label: string; value: string | number; icon: React.ReactNode; color: string; bg: string; }

function StatCard({ label, value, icon, color, bg }: Stat) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 ${bg} rounded-2xl flex items-center justify-center flex-shrink-0`}>
        <span className={color}>{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-extrabold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function OnlineDot({ online }: { online: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-gray-300'}`} />
  );
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function DashboardPage() {
  const [devices, setDevices]   = useState<Device[]>([]);
  const [recentLocs, setLocs]   = useState<LocationLog[]>([]);
  const [recentNots, setNots]   = useState<NotificationLog[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const devRes = await devicesApi.list();
        const devs: Device[] = devRes.data;
        setDevices(devs);

        const childDevices = devs.filter((d) => d.role === 'child');
        if (childDevices.length > 0) {
          const first = childDevices[0].deviceId;
          const [locRes, notRes] = await Promise.allSettled([
            locationApi.history(first, 5),
            notificationsApi.list(first, 10),
          ]);
          if (locRes.status === 'fulfilled') setLocs(locRes.value.data);
          if (notRes.status === 'fulfilled') setNots(notRes.value.data);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const online    = devices.filter((d) => d.isOnline).length;
  const children  = devices.filter((d) => d.role === 'child').length;

  const stats: Stat[] = [
    { label: 'Total Devices',    value: devices.length, icon: <Smartphone size={22} />, color: 'text-blue-600',  bg: 'bg-blue-50' },
    { label: 'Online Now',       value: online,         icon: <Wifi size={22} />,       color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Child Devices',    value: children,       icon: <Activity size={22} />,   color: 'text-purple-600',bg: 'bg-purple-50' },
    { label: 'Recent Alerts',    value: recentNots.length, icon: <Bell size={22} />,   color: 'text-orange-500',bg: 'bg-orange-50' },
  ];

  return (
    <>
      <Header title="Overview" subtitle={`Today, ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`} />

      <main className="flex-1 p-8 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
              {stats.map((s) => <StatCard key={s.label} {...s} />)}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Device status list */}
              <div className="xl:col-span-2 card">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold text-gray-900 text-lg">Device Status</h3>
                  <span className="text-xs text-gray-400">{devices.length} registered</span>
                </div>
                {devices.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Smartphone size={40} className="mx-auto mb-3 opacity-30" />
                    <p>No devices yet. Add one from the Devices page.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {devices.map((d) => (
                      <div key={d.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                            <Smartphone size={18} className="text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{d.name}</p>
                            <p className="text-xs text-gray-500 capitalize">{d.role} device</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{timeAgo(d.lastSeen)}</span>
                          <span className={d.isOnline ? 'badge-online' : 'badge-offline'}>
                            <OnlineDot online={d.isOnline} />
                            {d.isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent activity */}
              <div className="card">
                <h3 className="font-bold text-gray-900 text-lg mb-5">Recent Activity</h3>
                {recentNots.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Bell size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No activity yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentNots.map((n) => (
                      <div key={n.id} className="flex gap-3 items-start">
                        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Bell size={14} className="text-orange-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{n.appName}</p>
                          <p className="text-xs text-gray-500 truncate">{n.title ?? n.body ?? 'No content'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.postedAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent locations */}
            {recentLocs.length > 0 && (
              <div className="card">
                <h3 className="font-bold text-gray-900 text-lg mb-5 flex items-center gap-2">
                  <MapPin size={20} className="text-primary" />
                  Recent Locations
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
                        <th className="pb-3 pr-4">Coordinates</th>
                        <th className="pb-3 pr-4">Address</th>
                        <th className="pb-3 pr-4">Accuracy</th>
                        <th className="pb-3">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {recentLocs.map((l) => (
                        <tr key={l.id} className="hover:bg-gray-50">
                          <td className="py-3 pr-4 font-mono text-xs text-gray-600">
                            {l.latitude.toFixed(5)}, {l.longitude.toFixed(5)}
                          </td>
                          <td className="py-3 pr-4 text-gray-700">{l.address ?? '—'}</td>
                          <td className="py-3 pr-4 text-gray-500">{l.accuracy ? `${Math.round(l.accuracy)}m` : '—'}</td>
                          <td className="py-3 text-gray-400">{timeAgo(l.capturedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
