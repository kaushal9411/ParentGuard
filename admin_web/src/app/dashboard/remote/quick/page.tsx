'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Shield, Loader, CheckCircle, AlertCircle, Wifi, WifiOff, RefreshCw, Lock } from 'lucide-react';
import Header from '@/components/Header';
import { devicesApi, userCommandsApi } from '@/lib/api';
import type { Device } from '@/types';
import PageLoader from '@/components/PageLoader';

interface Cmd {
  id: string; commandType: string; payload: string;
  status: string; result: string | null;
  issuedAt: string; completedAt: string | null;
}

function parseResult(raw: string | null) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

const STATUS: Record<string, { label: string; color: string; dot: string }> = {
  pending:   { label: 'Waiting…',  color: 'text-yellow-600', dot: 'bg-yellow-400 animate-pulse' },
  delivered: { label: 'Delivered', color: 'text-blue-600',   dot: 'bg-blue-400 animate-pulse' },
  executing: { label: 'Running…',  color: 'text-indigo-600', dot: 'bg-indigo-400 animate-pulse' },
  completed: { label: 'Done',      color: 'text-green-600',  dot: 'bg-green-500' },
  failed:    { label: 'Failed',    color: 'text-red-600',    dot: 'bg-red-500' },
  cancelled: { label: 'Cancelled', color: 'text-gray-400',   dot: 'bg-gray-400' },
};

function fmtTime(s: string) {
  return new Date(s).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}

function StatusCard({ cmd }: { cmd: Cmd }) {
  const result = parseResult(cmd.result);
  const st     = STATUS[cmd.status] ?? STATUS.pending;
  const typeLabel = cmd.commandType.replace(/_/g, ' ');

  return (
    <div className="card flex items-start justify-between gap-4 py-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Lock size={14} className="text-indigo-500 flex-shrink-0" />
          <span className="text-sm font-semibold capitalize">{typeLabel}</span>
        </div>
        {result && (
          <p className={`text-xs mt-1 flex items-center gap-1 ${result.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
            {result.type === 'error'
              ? <AlertCircle size={11} />
              : <CheckCircle size={11} />}
            {String(result.message ?? result.status ?? JSON.stringify(result))}
          </p>
        )}
        <p className="text-xs text-gray-400 mt-1">{fmtTime(cmd.issuedAt)}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`w-2 h-2 rounded-full ${st.dot}`} />
        <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
      </div>
    </div>
  );
}

export default function RemoteQuickPage() {
  const [devices, setDevices]  = useState<Device[]>([]);
  const [selected, setSelected] = useState('');
  const [commands, setCommands] = useState<Cmd[]>([]);
  const [busy, setBusy]        = useState<string | null>(null);
  const [loading, setLoading]  = useState(false);
  const [pkgInput, setPkgInput] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    devicesApi.list().then((r) => {
      const devs: Device[] = r.data;
      setDevices(devs);
      const first = devs.find((d) => d.role === 'child');
      if (first) setSelected(first.deviceId);
    });
  }, []);

  const fetchCommands = useCallback(async () => {
    if (!selected) return;
    try {
      const r = await userCommandsApi.list(selected);
      setCommands((r.data as Cmd[]).filter((c) =>
        ['lock_device','block_app','unblock_app'].includes(c.commandType)));
    } catch {}
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetchCommands().finally(() => setLoading(false));
    pollRef.current = setInterval(fetchCommands, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected, fetchCommands]);

  async function send(type: string, payload?: Record<string, unknown>) {
    if (!selected) return;
    setBusy(type);
    try {
      await userCommandsApi.issue(selected, type, payload);
      await fetchCommands();
    } finally { setBusy(null); }
  }

  const device = devices.find((d) => d.deviceId === selected);

  return (
    <>
      <Header title="Quick Commands" subtitle="Lock device and manage app access" />

      <main className="flex-1 p-8 space-y-6">
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
            <button onClick={fetchCommands} className="ml-auto text-gray-400 hover:text-primary">
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Lock */}
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-800">Device Lock</h3>
          <button onClick={() => send('lock_device')} disabled={!!busy}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 shadow-md">
            {busy === 'lock_device' ? <Loader size={16} className="animate-spin" /> : <Shield size={16} />}
            🔒 Lock Device Now
          </button>
          <p className="text-xs text-gray-400">
            Sends a lock command to the child device. Device will lock on next poll cycle.
          </p>
        </div>

        {/* Block / Unblock App */}
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-800">Block / Unblock App</h3>
          <div className="flex gap-2">
            <input value={pkgInput} onChange={(e) => setPkgInput(e.target.value)}
              className="input flex-1" placeholder="Package name e.g. com.whatsapp" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { if (pkgInput.trim()) send('block_app', { packageName: pkgInput.trim() }); }}
              disabled={!!busy || !pkgInput.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm disabled:opacity-60">
              {busy === 'block_app' ? <Loader size={14} className="animate-spin" /> : null}
              Block
            </button>
            <button onClick={() => { if (pkgInput.trim()) send('unblock_app', { packageName: pkgInput.trim() }); }}
              disabled={!!busy || !pkgInput.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm disabled:opacity-60">
              {busy === 'unblock_app' ? <Loader size={14} className="animate-spin" /> : null}
              Unblock
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Enter the Android package name exactly (e.g. com.instagram.android).
          </p>
        </div>

        {loading ? (
          <PageLoader />
        ) : commands.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">
            <Shield size={36} className="mx-auto mb-3 opacity-30" />
            <p>No quick commands sent yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-700 text-sm">Command History</h3>
            {commands.map((cmd) => <StatusCard key={cmd.id} cmd={cmd} />)}
          </div>
        )}
      </main>
    </>
  );
}
