'use client';
import { useEffect, useState } from 'react';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Search } from 'lucide-react';
import Header from '@/components/Header';
import { devicesApi, userCallsApi } from '@/lib/api';
import PageLoader from '@/components/PageLoader';
import type { Device } from '@/types';

interface CallLog {
  id: string; deviceId: string;
  number: string; name: string | null;
  type: string; duration: number;
  timestamp: string;
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function typeInfo(type: string): { label: string; color: string; Icon: typeof Phone } {
  const t = type?.toLowerCase() ?? '';
  if (t.includes('incoming') || t === '1')
    return { label: 'Incoming', color: 'text-green-600 bg-green-50', Icon: PhoneIncoming };
  if (t.includes('outgoing') || t === '2')
    return { label: 'Outgoing', color: 'text-blue-600 bg-blue-50', Icon: PhoneOutgoing };
  return { label: 'Missed', color: 'text-red-600 bg-red-50', Icon: PhoneMissed };
}

export default function CallsPage() {
  const [devices, setDevices]   = useState<Device[]>([]);
  const [selected, setSelected] = useState('');
  const [logs, setLogs]         = useState<CallLog[]>([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [limit, setLimit]       = useState(500);

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
    userCallsApi.list(selected, limit, search || undefined)
      .then((r) => setLogs(r.data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [selected, limit, search]);

  const incoming = logs.filter((l) => l.type?.toLowerCase().includes('incoming') || l.type === '1').length;
  const outgoing = logs.filter((l) => l.type?.toLowerCase().includes('outgoing') || l.type === '2').length;
  const missed   = logs.length - incoming - outgoing;

  const filtered = search
    ? logs.filter((l) =>
        l.number.includes(search) || (l.name ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <>
      <Header title="Call Logs" subtitle="Incoming, outgoing and missed calls" />
      <main className="flex-1 p-8 space-y-6">

        {/* Device selector */}
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
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Incoming', value: incoming, color: 'bg-green-50 border-green-100 text-green-700' },
            { label: 'Outgoing', value: outgoing, color: 'bg-blue-50 border-blue-100 text-blue-700' },
            { label: 'Missed',   value: missed,   color: 'bg-red-50 border-red-100 text-red-700' },
          ].map((s) => (
            <div key={s.label} className={`card border ${s.color} py-4`}>
              <p className="text-2xl font-extrabold">{s.value}</p>
              <p className="text-xs mt-0.5 opacity-70">{s.label} calls</p>
            </div>
          ))}
        </div>

        {loading ? <PageLoader /> : (
          <div className="card p-6">
            {/* Header row */}
            <div className="flex items-center gap-3 mb-5">
              <Phone size={18} className="text-primary" />
              <h3 className="font-bold text-gray-900">Call Log</h3>
              <span className="ml-1 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{logs.length}</span>
              <div className="ml-auto relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search number or name…"
                  className="input pl-7 text-sm w-52" />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <Phone size={48} className="mx-auto mb-3 text-gray-200" />
                <p className="text-gray-500 font-medium">No call logs</p>
                <p className="text-gray-400 text-sm mt-1">
                  {search ? 'No results match your search' : 'Call logs will appear here once synced'}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400 text-xs">
                        <th className="text-left pb-3 pr-4 font-semibold">Contact</th>
                        <th className="text-left pb-3 pr-4 font-semibold">Number</th>
                        <th className="text-left pb-3 pr-4 font-semibold">Type</th>
                        <th className="text-left pb-3 pr-4 font-semibold">Duration</th>
                        <th className="text-left pb-3 font-semibold">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filtered.map((log) => {
                        const ti = typeInfo(log.type);
                        return (
                          <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3 pr-4 font-semibold text-gray-900">
                              {log.name ?? <span className="text-gray-400 italic font-normal">Unknown</span>}
                            </td>
                            <td className="py-3 pr-4 text-gray-500 font-mono text-xs">{log.number}</td>
                            <td className="py-3 pr-4">
                              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${ti.color}`}>
                                <ti.Icon size={10} /> {ti.label}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-gray-600">{fmtDuration(log.duration)}</td>
                            <td className="py-3 text-gray-400 text-xs whitespace-nowrap">{timeAgo(log.timestamp)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {logs.length >= limit && (
                  <div className="text-center pt-4 border-t border-gray-100 mt-4">
                    <button onClick={() => setLimit((l) => l + 500)} className="text-sm text-primary hover:underline">
                      Load more
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </>
  );
}
