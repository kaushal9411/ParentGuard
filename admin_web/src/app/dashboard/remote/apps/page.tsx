'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { AppWindow, Loader, RefreshCw, Search, Wifi, WifiOff, Ban, ShieldOff } from 'lucide-react';
import Header from '@/components/Header';
import { devicesApi, userCommandsApi, userAppBlocksApi } from '@/lib/api';
import PageLoader from '@/components/PageLoader';
import type { Device } from '@/types';
import { toast } from 'sonner';

interface Cmd      { id: string; commandType: string; status: string; result: string | null; issuedAt: string; }
interface AppEntry { packageName: string; appName: string; versionName: string; installedAt: number; }
interface AppBlock { id: string; packageName: string; appName: string; isBlocked: boolean; }

function fmtDate(ms: number) { return ms ? new Date(ms).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'; }

export default function RemoteAppsPage() {
  const [devices,  setDevices]  = useState<Device[]>([]);
  const [selected, setSelected] = useState('');
  const [commands, setCommands] = useState<Cmd[]>([]);
  const [blocks,   setBlocks]   = useState<AppBlock[]>([]);
  const [busy,     setBusy]     = useState(false);
  const [busyPkg,  setBusyPkg]  = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [search,   setSearch]   = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    devicesApi.list().then((r) => {
      const devs: Device[] = r.data;
      setDevices(devs);
      const first = devs.find((d) => d.role === 'child');
      if (first) setSelected(first.deviceId);
    });
  }, []);

  const fetchBlocks = useCallback(async () => {
    if (!selected) return;
    try {
      const r = await userAppBlocksApi.list(selected);
      setBlocks(r.data as AppBlock[]);
    } catch {}
  }, [selected]);

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
    Promise.all([fetchCmds(), fetchBlocks()]).finally(() => setLoading(false));
    pollRef.current = setInterval(fetchCmds, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected, fetchCmds, fetchBlocks]);

  async function scan() {
    if (!selected) return;
    setBusy(true);
    try { await userCommandsApi.issue(selected, 'list_apps'); await fetchCmds(); }
    finally { setBusy(false); }
  }

  async function toggleBlock(app: AppEntry) {
    if (!selected) return;
    const existing = blocks.find((b) => b.packageName === app.packageName && b.isBlocked);
    const willBlock = !existing;
    setBusyPkg(app.packageName);
    try {
      if (willBlock) {
        await userAppBlocksApi.create({
          deviceId: selected, packageName: app.packageName,
          appName: app.appName, isBlocked: true,
        });
      } else {
        await userAppBlocksApi.delete(existing!.id);
      }
      await userCommandsApi.issue(selected, willBlock ? 'block_app' : 'unblock_app', {
        packageName: app.packageName,
      });
      await fetchBlocks();
      toast.success(willBlock ? `Blocking ${app.appName}` : `Unblocking ${app.appName}`);
    } catch {
      toast.error('Failed — try again');
    } finally {
      setBusyPkg(null);
    }
  }

  const latest  = commands.find((c) => c.status === 'completed' && c.result);
  const pending = commands.find((c) => ['pending', 'delivered', 'executing'].includes(c.status));
  let apps: AppEntry[] = [];
  if (latest?.result) { try { apps = JSON.parse(latest.result)?.entries ?? []; } catch {} }
  const filtered = apps.filter((a) =>
    !search || a.appName.toLowerCase().includes(search.toLowerCase()) ||
    a.packageName.toLowerCase().includes(search.toLowerCase()));

  const blockedSet = new Set(blocks.filter((b) => b.isBlocked).map((b) => b.packageName));
  const device     = devices.find((d) => d.deviceId === selected);

  return (
    <>
      <Header title="Installed Apps" subtitle="View and block apps on child's device" />
      <main className="flex-1 p-8 space-y-4">

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
            {device && (
              <div className={`flex items-center gap-1.5 text-sm ${device.isOnline ? 'text-green-600' : 'text-gray-400'}`}>
                {device.isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                {device.isOnline ? 'Online' : 'Offline'}
              </div>
            )}
            <button onClick={() => Promise.all([fetchCmds(), fetchBlocks()])}
              className="ml-auto text-gray-400 hover:text-primary"><RefreshCw size={15} /></button>
          </div>
        </div>

        <button onClick={scan} disabled={busy || !selected}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 shadow-md">
          {busy ? <Loader size={16} className="animate-spin" /> : <AppWindow size={16} />}
          Scan Installed Apps
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
                {/* Search bar */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <Search size={14} className="text-gray-400" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 bg-transparent text-gray-800 text-sm focus:outline-none placeholder-gray-400"
                    placeholder="Search app name or package…" />
                  <span className="text-gray-400 text-xs">{filtered.length} / {apps.length}</span>
                  {blockedSet.size > 0 && (
                    <span className="text-red-600 text-xs font-semibold bg-red-100 px-2 py-0.5 rounded-full">
                      {blockedSet.size} blocked
                    </span>
                  )}
                </div>

                {/* App rows */}
                <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                  {filtered.map((a) => {
                    const isBlocked = blockedSet.has(a.packageName);
                    const isBusy    = busyPkg === a.packageName;
                    return (
                      <div key={a.packageName}
                        className={`flex items-center gap-3 px-4 py-3 transition-colors
                          ${isBlocked ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}>
                        {/* Avatar */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm
                          ${isBlocked ? 'bg-red-200 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                          {isBlocked ? <Ban size={16} /> : a.appName.charAt(0).toUpperCase()}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-semibold truncate ${isBlocked ? 'text-red-700' : 'text-gray-900'}`}>
                              {a.appName}
                            </p>
                            {isBlocked && (
                              <span className="text-[10px] text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
                                BLOCKED
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 text-xs font-mono truncate">{a.packageName}</p>
                        </div>

                        {/* Version + date */}
                        <div className="text-right flex-shrink-0 hidden sm:block">
                          <p className="text-gray-500 text-xs">{a.versionName}</p>
                          <p className="text-gray-400 text-xs">{fmtDate(a.installedAt)}</p>
                        </div>

                        {/* Block / Unblock button */}
                        <button
                          onClick={() => toggleBlock(a)}
                          disabled={!!busyPkg}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50
                            ${isBlocked
                              ? 'bg-green-100 hover:bg-green-200 text-green-700 border border-green-300'
                              : 'bg-red-100 hover:bg-red-200 text-red-700 border border-red-200'}`}>
                          {isBusy
                            ? <Loader size={11} className="animate-spin" />
                            : isBlocked ? <ShieldOff size={11} /> : <Ban size={11} />}
                          {isBlocked ? 'Unblock' : 'Block'}
                        </button>
                      </div>
                    );
                  })}
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
