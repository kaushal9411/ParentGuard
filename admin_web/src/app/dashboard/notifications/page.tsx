'use client';
import { useEffect, useState } from 'react';
import { Bell, MessageSquare, Filter } from 'lucide-react';
import Header from '@/components/Header';
import { devicesApi, notificationsApi } from '@/lib/api';
import type { Device, NotificationLog } from '@/types';
import PageLoader from '@/components/PageLoader';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function AppIcon({ name }: { name: string }) {
  const colors = ['bg-blue-500','bg-purple-500','bg-green-500','bg-orange-500','bg-pink-500','bg-cyan-500'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-sm`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function NotificationsPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState('');
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    devicesApi.list().then((r) => {
      const devs: Device[] = r.data;
      setDevices(devs);
      const first = devs.find((d) => d.role === 'child');
      if (first) setSelected(first.deviceId);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    notificationsApi.list(selected, limit)
      .then((r) => setLogs(r.data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [selected, limit]);

  const filtered = logs.filter((n) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      n.appName.toLowerCase().includes(q) ||
      (n.title ?? '').toLowerCase().includes(q) ||
      (n.body ?? '').toLowerCase().includes(q)
    );
  });

  // Group by date
  const grouped = filtered.reduce<Record<string, NotificationLog[]>>((acc, n) => {
    const key = new Date(n.postedAt).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
    (acc[key] ??= []).push(n);
    return acc;
  }, {});

  return (
    <>
      <Header title="Notifications" subtitle="Messages and alerts captured from child's device" />

      <main className="flex-1 p-8 space-y-6">
        {/* Controls */}
        <div className="card py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700">Device:</label>
              <select value={selected} onChange={(e) => setSelected(e.target.value)} className="input max-w-xs">
                {devices.filter((d) => d.role === 'child').map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <Filter size={16} className="text-gray-400 flex-shrink-0" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                className="input" placeholder="Search app, title, or content…" />
            </div>

            <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
              <span className="font-semibold text-gray-900">{filtered.length}</span> notifications
            </div>
          </div>
        </div>

        {loading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <div className="card text-center py-20">
            <Bell size={56} className="mx-auto mb-4 text-gray-200" />
            <h3 className="text-lg font-bold text-gray-600">No notifications</h3>
            <p className="text-gray-400 mt-1">
              {search ? 'No results match your search' : 'No notifications captured yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{date}</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                <div className="space-y-3">
                  {items.map((n) => (
                    <div key={n.id} className="card py-4 flex items-start gap-4 hover:shadow-card-hover transition-shadow">
                      <AppIcon name={n.appName} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{n.appName}</span>
                            {n.title && (
                              <p className="font-semibold text-gray-900 text-sm mt-0.5">{n.title}</p>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{timeAgo(n.postedAt)}</span>
                        </div>
                        {n.body && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{n.body}</p>
                        )}
                        {n.packageName && (
                          <p className="text-xs text-gray-400 font-mono mt-1.5">{n.packageName}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {logs.length >= limit && (
              <div className="text-center">
                <button onClick={() => setLimit((l) => l + 50)} className="btn-outline mx-auto">
                  <MessageSquare size={16} /> Load more
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
