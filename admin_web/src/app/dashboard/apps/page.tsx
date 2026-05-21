'use client';
import { useEffect, useState } from 'react';
import { BarChart2, Clock } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import Header from '@/components/Header';
import { devicesApi, usageApi } from '@/lib/api';
import type { Device, AppUsageLog } from '@/types';
import PageLoader from '@/components/PageLoader';

function msToHm(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const COLORS = ['#1A3A8F','#4A90E2','#6BA5E7','#93BCE8','#B8D3F0','#D4E5F7','#E8F2FB'];

export default function AppsPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [logs, setLogs] = useState<AppUsageLog[]>([]);
  const [loading, setLoading] = useState(false);

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
    usageApi.daily(selected, date)
      .then((r) => setLogs(r.data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [selected, date]);

  const totalMs = logs.reduce((s, l) => s + Number(l.usageDurationMs), 0);

  const chartData = logs.slice(0, 10).map((l) => ({
    name: l.appName.length > 14 ? l.appName.slice(0, 14) + '…' : l.appName,
    minutes: Math.round(Number(l.usageDurationMs) / 60000),
    full: l.appName,
  }));

  return (
    <>
      <Header title="App Usage" subtitle="See which apps your child uses most" />

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
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700">Date:</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]} className="input max-w-xs" />
            </div>
            {totalMs > 0 && (
              <div className="ml-auto flex items-center gap-2 bg-blue-50 text-primary px-4 py-2 rounded-xl text-sm font-semibold">
                <Clock size={16} />
                Total: {msToHm(totalMs)}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <PageLoader />
        ) : logs.length === 0 ? (
          <div className="card text-center py-20">
            <BarChart2 size={56} className="mx-auto mb-4 text-gray-200" />
            <h3 className="text-lg font-bold text-gray-600">No usage data</h3>
            <p className="text-gray-400 mt-1">No app usage recorded for this date</p>
          </div>
        ) : (
          <>
            {/* Bar chart */}
            <div className="card">
              <h3 className="font-bold text-gray-900 mb-6">Top Apps by Usage Time</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 12 }} unit="m" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={110} />
                  <Tooltip
                    formatter={(v: number) => [`${v} min`, 'Usage']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                  />
                  <Bar dataKey="minutes" radius={[0, 6, 6, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="card">
              <h3 className="font-bold text-gray-900 mb-5">All Apps</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                      <th className="pb-3 pr-4">#</th>
                      <th className="pb-3 pr-4">App Name</th>
                      <th className="pb-3 pr-4">Package</th>
                      <th className="pb-3 pr-4">Usage</th>
                      <th className="pb-3">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {logs.map((l, i) => {
                      const ms = Number(l.usageDurationMs);
                      const pct = totalMs > 0 ? Math.round((ms / totalMs) * 100) : 0;
                      return (
                        <tr key={l.id} className="hover:bg-gray-50">
                          <td className="py-3 pr-4 text-gray-400 font-mono text-xs">{i + 1}</td>
                          <td className="py-3 pr-4 font-semibold text-gray-900">{l.appName}</td>
                          <td className="py-3 pr-4 font-mono text-xs text-gray-400">{l.packageName}</td>
                          <td className="py-3 pr-4">
                            <span className="font-semibold text-primary">{msToHm(ms)}</span>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-100 rounded-full max-w-24">
                                <div className="h-2 rounded-full bg-primary"
                                  style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-gray-500">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
