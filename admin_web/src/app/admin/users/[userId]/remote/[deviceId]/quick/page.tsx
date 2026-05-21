'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Shield, Loader, CheckCircle, AlertCircle, Lock, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import PageLoader from '@/components/PageLoader';

interface Cmd { id: string; commandType: string; status: string; result: string | null; issuedAt: string; }
interface DeviceInfo { deviceId: string; name: string; isOnline: boolean; }

function parseResult(raw: string | null) { if (!raw) return null; try { return JSON.parse(raw); } catch { return null; } }
function fmtTime(s: string) { return new Date(s).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }); }

const STATUS: Record<string, { label: string; color: string; dot: string }> = {
  pending:   { label: 'Waiting…',  color: 'text-yellow-400', dot: 'bg-yellow-400 animate-pulse' },
  delivered: { label: 'Delivered', color: 'text-blue-400',   dot: 'bg-blue-400 animate-pulse' },
  executing: { label: 'Running…',  color: 'text-indigo-400', dot: 'bg-indigo-400 animate-pulse' },
  completed: { label: 'Done',      color: 'text-green-400',  dot: 'bg-green-400' },
  failed:    { label: 'Failed',    color: 'text-red-400',    dot: 'bg-red-500' },
};

function CmdCard({ cmd }: { cmd: Cmd }) {
  const result = parseResult(cmd.result);
  const st = STATUS[cmd.status] ?? STATUS.pending;
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-start justify-between gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Lock size={13} className="text-indigo-400 flex-shrink-0" />
          <span className="text-white text-sm font-semibold capitalize">{cmd.commandType.replace(/_/g,' ')}</span>
        </div>
        {result && (
          <p className={`text-xs mt-1 flex items-center gap-1 ${result.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
            {result.type === 'error' ? <AlertCircle size={11} /> : <CheckCircle size={11} />}
            {String(result.message ?? JSON.stringify(result))}
          </p>
        )}
        <p className="text-xs text-gray-600 mt-1">{fmtTime(cmd.issuedAt)}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`w-2 h-2 rounded-full ${st.dot}`} />
        <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
      </div>
    </div>
  );
}

export default function AdminRemoteQuickPage() {
  const { userId, deviceId } = useParams<{ userId: string; deviceId: string }>();
  const router = useRouter();
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [commands, setCommands] = useState<Cmd[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pkgInput, setPkgInput] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    adminApi.userDetail(userId).then((r) => {
      setDevice(r.data.devices?.find((d: DeviceInfo) => d.deviceId === deviceId) ?? null);
    }).catch(() => {});
  }, [userId, deviceId]);

  const fetchCmds = useCallback(async () => {
    try {
      const r = await adminApi.deviceCommands(deviceId);
      setCommands((r.data as Cmd[]).filter((c) =>
        ['lock_device','block_app','unblock_app'].includes(c.commandType)));
    } catch {}
  }, [deviceId]);

  useEffect(() => {
    setLoading(true);
    fetchCmds().finally(() => setLoading(false));
    pollRef.current = setInterval(fetchCmds, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchCmds]);

  async function send(type: string, payload?: Record<string, unknown>) {
    setBusy(type);
    try { await adminApi.issueCommand(deviceId, type, payload); await fetchCmds(); }
    finally { setBusy(null); }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-8 pt-8 pb-5 border-b border-gray-800">
        <button onClick={() => router.push(`/admin/users/${userId}/remote/${deviceId}`)}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors">
          <ArrowLeft size={15} /> Remote Access
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
              <Shield size={20} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white">Quick Commands</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-gray-400 text-sm">{device?.name ?? deviceId}</span>
                {device?.isOnline
                  ? <span className="flex items-center gap-1 text-green-400 text-xs"><Wifi size={11} /> Live</span>
                  : <span className="flex items-center gap-1 text-gray-500 text-xs"><WifiOff size={11} /> Offline</span>}
              </div>
            </div>
          </div>
          <button onClick={fetchCmds} className="text-gray-600 hover:text-gray-300 transition-colors"><RefreshCw size={15} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* Lock */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-white font-bold">Device Lock</h3>
          <button onClick={() => send('lock_device')} disabled={!!busy}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 shadow-lg">
            {busy === 'lock_device' ? <Loader size={16} className="animate-spin" /> : <Shield size={16} />}
            🔒 Lock Device Now
          </button>
          <p className="text-xs text-gray-500">Device locks on next poll cycle (≤1 min).</p>
        </div>

        {/* Block / Unblock */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-white font-bold">Block / Unblock App</h3>
          <input value={pkgInput} onChange={(e) => setPkgInput(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 font-mono"
            placeholder="com.whatsapp, com.instagram.android…" />
          <div className="flex gap-2 flex-wrap">
            {[
              { name: 'WhatsApp', pkg: 'com.whatsapp' },
              { name: 'Instagram', pkg: 'com.instagram.android' },
              { name: 'YouTube', pkg: 'com.google.android.youtube' },
              { name: 'TikTok', pkg: 'com.zhiliaoapp.musically' },
              { name: 'BGMI', pkg: 'com.pubg.imobile' },
              { name: 'Free Fire', pkg: 'com.dts.freefireth' },
            ].map((a) => (
              <button key={a.pkg} type="button" onClick={() => setPkgInput(a.pkg)}
                className="text-xs px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-indigo-700 text-gray-400 hover:text-white transition-colors">
                {a.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { if (pkgInput.trim()) send('block_app', { packageName: pkgInput.trim() }); }}
              disabled={!!busy || !pkgInput.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white font-semibold text-sm disabled:opacity-50 transition-colors">
              {busy === 'block_app' ? <Loader size={14} className="animate-spin" /> : null} Block
            </button>
            <button onClick={() => { if (pkgInput.trim()) send('unblock_app', { packageName: pkgInput.trim() }); }}
              disabled={!!busy || !pkgInput.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-700 hover:bg-green-600 text-white font-semibold text-sm disabled:opacity-50 transition-colors">
              {busy === 'unblock_app' ? <Loader size={14} className="animate-spin" /> : null} Unblock
            </button>
          </div>
        </div>

        {/* History */}
        {loading ? <PageLoader theme="dark" /> : commands.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <Shield size={36} className="mx-auto mb-3 opacity-20" />
            <p>No quick commands sent yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">History</p>
            {commands.map((cmd) => <CmdCard key={cmd.id} cmd={cmd} />)}
          </div>
        )}
      </div>
    </div>
  );
}
