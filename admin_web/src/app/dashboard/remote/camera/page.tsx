'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Camera, Video, Loader, Clock, AlertCircle, Download, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import Header from '@/components/Header';
import { devicesApi, userCommandsApi } from '@/lib/api';
import type { Device } from '@/types';
import PageLoader from '@/components/PageLoader';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

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
  pending:   { label: 'Waiting for device…',  color: 'text-yellow-600', dot: 'bg-yellow-400 animate-pulse' },
  delivered: { label: 'Command delivered',     color: 'text-blue-600',   dot: 'bg-blue-400 animate-pulse' },
  executing: { label: 'Executing…',            color: 'text-indigo-600', dot: 'bg-indigo-400 animate-pulse' },
  completed: { label: 'Completed',             color: 'text-green-600',  dot: 'bg-green-500' },
  failed:    { label: 'Failed',                color: 'text-red-600',    dot: 'bg-red-500' },
  cancelled: { label: 'Cancelled',             color: 'text-gray-400',   dot: 'bg-gray-400' },
};

function fmtTime(s: string) {
  return new Date(s).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' });
}

function PhotoCard({ cmd }: { cmd: Cmd }) {
  const result  = parseResult(cmd.result);
  const st      = STATUS[cmd.status] ?? STATUS.pending;
  const payload = cmd.payload ? (() => { try { return JSON.parse(cmd.payload); } catch { return {}; } })() : {};
  const isPending = ['pending','delivered','executing'].includes(cmd.status);
  const isVideo = cmd.commandType === 'capture_video';

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {isVideo ? <Video size={14} className="text-rose-500" /> : <Camera size={14} className="text-pink-500" />}
          <span className="text-sm font-semibold capitalize">
            {payload.camera ?? 'back'} camera{isVideo ? ' · video' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${st.dot}`} />
          <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
        </div>
      </div>

      {result?.type === 'video_url' && result.url ? (
        <div className="relative">
          <video src={`${API_URL}${result.url}`} controls className="w-full max-h-80 bg-gray-900" />
          <a href={`${API_URL}${result.url}`} download={`video_${cmd.id.slice(0,8)}.mp4`}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-xs px-3 py-1.5 rounded-full">
            <Download size={12} /> Save
          </a>
        </div>
      ) : result?.type === 'photo' && result.data ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:${result.mimeType ?? 'image/jpeg'};base64,${result.data}`}
            alt="Captured" className="w-full max-h-80 object-contain bg-gray-900" />
          <a href={`data:${result.mimeType ?? 'image/jpeg'};base64,${result.data}`}
            download={`photo_${cmd.id.slice(0,8)}.jpg`}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-xs px-3 py-1.5 rounded-full">
            <Download size={12} /> Save
          </a>
        </div>
      ) : isPending ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-400">
          <div className="w-10 h-10 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
          <p className="text-sm">Waiting for device to capture…</p>
          <p className="text-xs text-gray-300">Device checks every ~1 min</p>
        </div>
      ) : result?.type === 'error' ? (
        <div className="flex items-center gap-2 px-4 py-6 text-red-500 text-sm">
          <AlertCircle size={16} /> {String(result.message ?? 'Capture failed')}
        </div>
      ) : (
        <div className="px-4 py-6 text-gray-400 text-sm">No result yet</div>
      )}

      <div className="px-4 py-2 text-gray-400 text-xs border-t border-gray-100">
        {fmtTime(cmd.issuedAt)}
        {cmd.completedAt && ` · Done: ${fmtTime(cmd.completedAt)}`}
      </div>
    </div>
  );
}

export default function RemoteCameraPage() {
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
        c.commandType === 'capture_photo' || c.commandType === 'capture_video'));
    } catch {}
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetchCommands().finally(() => setLoading(false));
    pollRef.current = setInterval(fetchCommands, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected, fetchCommands]);

  async function send(facing: 'back' | 'front') {
    if (!selected) return;
    setBusy(facing);
    try {
      await userCommandsApi.issue(selected, 'capture_photo', { camera: facing });
      await fetchCommands();
    } finally { setBusy(null); }
  }

  async function sendVideo(facing: 'back' | 'front') {
    if (!selected) return;
    setBusy('vid_' + facing);
    try {
      await userCommandsApi.issue(selected, 'capture_video', { camera: facing, durationSeconds: 8 });
      await fetchCommands();
    } finally { setBusy(null); }
  }

  const device = devices.find((d) => d.deviceId === selected);

  return (
    <>
      <Header title="Remote Camera" subtitle="Capture photos from child's device" />

      <main className="flex-1 p-8 space-y-6">
        {/* Device selector + status */}
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

        {/* Action buttons */}
        <div className="flex gap-3 flex-wrap">
          {[
            { label: '📷 Back Camera',  facing: 'back'  as const, color: 'bg-pink-600 hover:bg-pink-700' },
            { label: '🤳 Front Camera', facing: 'front' as const, color: 'bg-purple-600 hover:bg-purple-700' },
          ].map((btn) => (
            <button key={btn.facing} onClick={() => send(btn.facing)} disabled={!!busy}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 shadow-md ${btn.color}`}>
              {busy === btn.facing ? <Loader size={16} className="animate-spin" /> : <Camera size={16} />}
              {btn.label}
            </button>
          ))}
          {[
            { label: '🎥 Back Video',  facing: 'back'  as const, color: 'bg-rose-600 hover:bg-rose-700' },
            { label: '🎥 Front Video', facing: 'front' as const, color: 'bg-fuchsia-600 hover:bg-fuchsia-700' },
          ].map((btn) => (
            <button key={'vid_' + btn.facing} onClick={() => sendVideo(btn.facing)} disabled={!!busy}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 shadow-md ${btn.color}`}>
              {busy === 'vid_' + btn.facing ? <Loader size={16} className="animate-spin" /> : <Video size={16} />}
              {btn.label}
            </button>
          ))}
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 flex items-start gap-2">
          <Clock size={13} className="mt-0.5 flex-shrink-0 text-blue-500" />
          After sending, the device captures on its next poll cycle (≤1 min). Photo appears below automatically.
        </div>

        {loading ? (
          <PageLoader />
        ) : commands.length === 0 ? (
          <div className="card text-center py-16 text-gray-400">
            <Camera size={40} className="mx-auto mb-3 opacity-30" />
            <p>No photos captured yet. Click a button above to send the command.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {commands.map((cmd) => <PhotoCard key={cmd.id} cmd={cmd} />)}
          </div>
        )}
      </main>
    </>
  );
}
