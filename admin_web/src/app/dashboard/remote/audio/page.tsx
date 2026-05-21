'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Mic, Loader, Clock, CheckCircle, Download, Wifi, WifiOff, RefreshCw } from 'lucide-react';
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
  pending:   { label: 'Waiting…',          color: 'text-yellow-600', dot: 'bg-yellow-400 animate-pulse' },
  delivered: { label: 'Delivered',          color: 'text-blue-600',   dot: 'bg-blue-400 animate-pulse' },
  executing: { label: 'Executing…',         color: 'text-indigo-600', dot: 'bg-indigo-400 animate-pulse' },
  completed: { label: 'Completed',          color: 'text-green-600',  dot: 'bg-green-500' },
  failed:    { label: 'Failed',             color: 'text-red-600',    dot: 'bg-red-500' },
  cancelled: { label: 'Cancelled',          color: 'text-gray-400',   dot: 'bg-gray-400' },
};

function fmtTime(s: string) {
  return new Date(s).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' });
}

function AudioCard({ cmd }: { cmd: Cmd }) {
  const result  = parseResult(cmd.result);
  const st      = STATUS[cmd.status] ?? STATUS.pending;
  const isPending = ['pending','delivered','executing'].includes(cmd.status);

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Mic size={14} className="text-red-500" />
          <span className="text-sm font-semibold capitalize">{cmd.commandType.replace(/_/g,' ')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${st.dot}`} />
          <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
        </div>
      </div>

      {result?.type === 'audio' && result.data ? (
        <div className="p-4 space-y-3">
          <audio controls src={`data:${result.mimeType ?? 'audio/mp4'};base64,${result.data}`} className="w-full" />
          <div className="flex items-center justify-between text-xs text-gray-500">
            {result.duration != null && (
              <span><Clock size={11} className="inline mr-1" />{result.duration}s</span>
            )}
            <a href={`data:${result.mimeType ?? 'audio/mp4'};base64,${result.data}`}
              download={`audio_${cmd.id.slice(0,8)}.m4a`}
              className="flex items-center gap-1 text-primary hover:text-primary-dark">
              <Download size={11} /> Download
            </a>
          </div>
        </div>
      ) : result?.type === 'status' ? (
        <div className="flex items-center gap-2 px-4 py-4 text-green-600 text-sm">
          <CheckCircle size={14} /> {String(result.message)}
        </div>
      ) : isPending ? (
        <div className="flex items-center gap-3 px-4 py-6 text-gray-400 text-sm">
          <div className="w-7 h-7 border-4 border-red-100 border-t-red-400 rounded-full animate-spin flex-shrink-0" />
          Waiting for device…
        </div>
      ) : (
        <div className="px-4 py-4 text-gray-400 text-sm">{cmd.result ?? 'No result yet'}</div>
      )}

      <div className="px-4 py-2 text-gray-400 text-xs border-t border-gray-100">{fmtTime(cmd.issuedAt)}</div>
    </div>
  );
}

export default function RemoteAudioPage() {
  const [devices, setDevices]  = useState<Device[]>([]);
  const [selected, setSelected] = useState('');
  const [commands, setCommands] = useState<Cmd[]>([]);
  const [busy, setBusy]        = useState<string | null>(null);
  const [loading, setLoading]  = useState(false);
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
        ['start_mic','stop_mic','start_recording','stop_recording'].includes(c.commandType)));
    } catch {}
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetchCommands().finally(() => setLoading(false));
    pollRef.current = setInterval(fetchCommands, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected, fetchCommands]);

  async function send(type: string) {
    if (!selected) return;
    setBusy(type);
    try {
      await userCommandsApi.issue(selected, type);
      await fetchCommands();
    } finally { setBusy(null); }
  }

  const device = devices.find((d) => d.deviceId === selected);

  return (
    <>
      <Header title="Audio Recording" subtitle="Remote microphone recording from child's device" />

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

        <div className="flex gap-3 flex-wrap">
          {[
            { label: '🎙 Start Recording', cmd: 'start_recording', color: 'bg-red-600 hover:bg-red-700' },
            { label: '⏹ Stop & Save',      cmd: 'stop_recording',  color: 'bg-gray-700 hover:bg-gray-600' },
          ].map((btn) => (
            <button key={btn.cmd} onClick={() => send(btn.cmd)} disabled={!!busy}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 shadow-md ${btn.color}`}>
              {busy === btn.cmd ? <Loader size={16} className="animate-spin" /> : <Mic size={16} />}
              {btn.label}
            </button>
          ))}
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
          <strong>How to record:</strong> Send "Start Recording" → wait ≈1 min for device to begin →
          send "Stop &amp; Save" → audio appears below after the next cycle.
        </div>

        {loading ? (
          <PageLoader />
        ) : commands.length === 0 ? (
          <div className="card text-center py-16 text-gray-400">
            <Mic size={40} className="mx-auto mb-3 opacity-30" />
            <p>No recordings yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {commands.map((cmd) => <AudioCard key={cmd.id} cmd={cmd} />)}
          </div>
        )}
      </main>
    </>
  );
}
