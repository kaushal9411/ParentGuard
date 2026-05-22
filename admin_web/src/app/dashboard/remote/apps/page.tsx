'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { AppWindow, Loader, RefreshCw, Search, Wifi, WifiOff } from 'lucide-react';
import Header from '@/components/Header';
import { devicesApi, userCommandsApi } from '@/lib/api';
import PageLoader from '@/components/PageLoader';
import type { Device } from '@/types';

interface Cmd { id: string; commandType: string; status: string; result: string | null; issuedAt: string; }
interface AppEntry { packageName: string; appName: string; versionName: string; installedAt: number; }

function fmtDate(ms: number) { return ms ? new Date(ms).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'; }

export default function RemoteAppsPage() {
  const [devices, setDevices]   = useState<Device[]>([]);
  const [selected, setSelected] = useState('');
  const [commands, setCommands] = useState<Cmd[]>([]);
  const [busy, setBusy]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    devicesApi.list().then((r) => {
      const devs: Device[] = r.data;
      setDevices(devs);
      const first = devs.find((d) => d.role === 'child');
      if (first) setSelected(first.deviceId);
    });
  }, []);

  const fetchCmds = useCallback(async () => {
    if (!selected) return;
    try {
      const r = await userCommandsApi.list(selected);
      setCommands((r.data as Cmd[]).filter((c) => c.commandType === 'list_apps'));
    } catch {}
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetchCmds().finally(() => setLoading(false));
    pollRef.current = setInterval(fetchCmds, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected, fetchCmds]);

  async function scan() {
    if (!selected) return;
    setBusy(true);
    try { await userCommandsApi.issue(selected, 'list_apps'); await fetchCmds(); }
    finally { setBusy(false); }
  }

  const latest = commands.find((c) => c.status === 'completed' && c.result);
  const pending = commands.find((c) => ['pending','delivered','executing'].includes(c.status));
  let apps: AppEntry[] = [];
  if (latest?.result) { try { apps = JSON.parse(latest.result)?.entries ?? []; } catch {} }
  const filtered = apps.filter((a) =>
    !search || a.appName.toLowerCase().includes(search.toLowerCase()) ||
    a.packageName.toLowerCase().includes(search.toLowerCase()));
  const device = devices.find((d) => d.deviceId === selected);

  return (
    <>
      <Header title="Installed Apps" subtitle="All apps installed on child's device" />
      <main className="flex-1 p-8 space-y-4">
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
            {device && (
              <div className={`flex items-center gap-1.5 text-sm ${device.isOnline ? 'text-green-600' : 'text-gray-400'}`}>
                {device.isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                {device.isOnline ? 'Online' : 'Offline'}
              </div>
            )}
            <button onClick={fetchCmds} className="ml-auto text-gray-400 hover:text-primary"><RefreshCw size={15} /></button>
          </div>
        </div>

        <button onClick={scan} disabled={busy || !selected}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 shadow-md">
          {busy ? <Loader size={16} className="animate-spin" /> : <AppWindow size={16} />}
          📱 Scan Installed Apps
        </button>

        {loading ? <PageLoader /> : (
          <>
            {pending && (
              <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-yellow-700 text-sm">
                <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                Scanning… (~10 s)
              </div>
            )}

            {apps.length > 0 && (
              <div className="card overflow-hidden p-0">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <Search size={14} className="text-gray-400" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 bg-transparent text-gray-800 text-sm focus:outline-none placeholder-gray-400"
                    placeholder="Search app name or package…" />
                  <span className="text-gray-400 text-xs">{filtered.length} / {apps.length}</span>
                </div>
                <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                  {filtered.map((a) => (
                    <div key={a.packageName} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0 text-emerald-700 font-bold text-sm">
                        {a.appName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 text-sm font-semibold truncate">{a.appName}</p>
                        <p className="text-gray-400 text-xs font-mono truncate">{a.packageName}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-gray-500 text-xs">{a.versionName}</p>
                        <p className="text-gray-400 text-xs">{fmtDate(a.installedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!apps.length && !pending && (
              <div className="card text-center py-16 text-gray-400">
                <AppWindow size={40} className="mx-auto mb-3 opacity-30" />
                <p>Click "Scan Installed Apps" to list apps.</p>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
