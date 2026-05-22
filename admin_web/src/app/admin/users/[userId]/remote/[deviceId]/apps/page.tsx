'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, AppWindow, Loader, RefreshCw, Search, Wifi, WifiOff } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import PageLoader from '@/components/PageLoader';

interface Cmd { id: string; commandType: string; status: string; result: string | null; issuedAt: string; }
interface DeviceInfo { deviceId: string; name: string; isOnline: boolean; }
interface AppEntry { packageName: string; appName: string; versionName: string; installedAt: number; }

function fmtDate(ms: number) { return ms ? new Date(ms).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'; }

export default function AdminAppsPage() {
  const { userId, deviceId } = useParams<{ userId: string; deviceId: string }>();
  const router = useRouter();
  const [device, setDevice]     = useState<DeviceInfo | null>(null);
  const [commands, setCommands] = useState<Cmd[]>([]);
  const [busy, setBusy]         = useState(false);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    adminApi.userDetail(userId).then((r) => {
      setDevice(r.data.devices?.find((d: DeviceInfo) => d.deviceId === deviceId) ?? null);
    }).catch(() => {});
  }, [userId, deviceId]);

  const fetchCmds = useCallback(async () => {
    try {
      const r = await adminApi.deviceCommands(deviceId);
      setCommands((r.data as Cmd[]).filter((c) => c.commandType === 'list_apps'));
    } catch {}
  }, [deviceId]);

  useEffect(() => {
    setLoading(true);
    fetchCmds().finally(() => setLoading(false));
    pollRef.current = setInterval(fetchCmds, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchCmds]);

  async function scan() {
    setBusy(true);
    try { await adminApi.issueCommand(deviceId, 'list_apps'); await fetchCmds(); }
    finally { setBusy(false); }
  }

  // Latest completed result
  const latest = commands.find((c) => c.status === 'completed' && c.result);
  const pending = commands.find((c) => ['pending','delivered','executing'].includes(c.status));
  let apps: AppEntry[] = [];
  if (latest?.result) {
    try { apps = JSON.parse(latest.result)?.entries ?? []; } catch {}
  }
  const filtered = apps.filter((a) =>
    !search || a.appName.toLowerCase().includes(search.toLowerCase()) ||
    a.packageName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-8 pt-8 pb-5 border-b border-gray-800">
        <button onClick={() => router.push(`/admin/users/${userId}/remote/${deviceId}`)}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors">
          <ArrowLeft size={15} /> Remote Access
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <AppWindow size={20} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white">Installed Apps</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-gray-400 text-sm">{device?.name ?? deviceId}</span>
                {device?.isOnline
                  ? <span className="flex items-center gap-1 text-green-400 text-xs"><Wifi size={11} /> Live</span>
                  : <span className="flex items-center gap-1 text-gray-500 text-xs"><WifiOff size={11} /> Offline</span>}
              </div>
            </div>
          </div>
          <button onClick={fetchCmds} className="text-gray-600 hover:text-gray-300"><RefreshCw size={15} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-4">
        <button onClick={scan} disabled={busy}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 shadow-lg">
          {busy ? <Loader size={16} className="animate-spin" /> : <AppWindow size={16} />}
          📱 Scan Installed Apps
        </button>

        {loading ? <PageLoader theme="dark" /> : (
          <>
            {pending && (
              <div className="flex items-center gap-3 bg-blue-900/20 border border-blue-800/40 rounded-xl px-4 py-3 text-blue-300 text-sm">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                Scanning… (~10 s)
              </div>
            )}

            {apps.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
                  <Search size={14} className="text-gray-500" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-gray-600"
                    placeholder="Search by app name or package…" />
                  <span className="text-gray-600 text-xs">{filtered.length} / {apps.length}</span>
                </div>
                <div className="divide-y divide-gray-800/50 max-h-[600px] overflow-y-auto">
                  {filtered.map((a) => (
                    <div key={a.packageName} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/40">
                      <div className="w-9 h-9 bg-emerald-700/30 rounded-xl flex items-center justify-center flex-shrink-0 text-emerald-400 font-bold text-sm">
                        {a.appName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{a.appName}</p>
                        <p className="text-gray-500 text-xs font-mono truncate">{a.packageName}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-gray-400 text-xs">{a.versionName}</p>
                        <p className="text-gray-600 text-xs">{fmtDate(a.installedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!apps.length && !pending && (
              <div className="text-center py-16 text-gray-600">
                <AppWindow size={40} className="mx-auto mb-3 opacity-20" />
                <p>Click "Scan Installed Apps" to list all apps on the device.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
