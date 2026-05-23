'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Monitor, Loader, Download, AlertCircle, RefreshCw, Wifi, WifiOff, Video, Square, Play } from 'lucide-react';
import Header from '@/components/Header';
import { devicesApi, userCommandsApi } from '@/lib/api';
import PageLoader from '@/components/PageLoader';
import type { Device } from '@/types';
import { toast } from 'sonner';

interface Cmd { id: string; commandType: string; status: string; result: string | null; issuedAt: string; completedAt: string | null; }

const STATUS: Record<string, { label: string; color: string; dot: string }> = {
  pending:   { label: 'Waiting…',   color: 'text-yellow-600', dot: 'bg-yellow-400 animate-pulse' },
  delivered: { label: 'Delivered',  color: 'text-blue-600',   dot: 'bg-blue-400 animate-pulse' },
  executing: { label: 'Capturing…', color: 'text-indigo-600', dot: 'bg-indigo-400 animate-pulse' },
  completed: { label: 'Done',       color: 'text-green-600',  dot: 'bg-green-500' },
  failed:    { label: 'Failed',     color: 'text-red-600',    dot: 'bg-red-500' },
};
function fmtTime(s: string) { return new Date(s).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' }); }
function fmtDuration(s: number) { const m = Math.floor(s / 60), sec = s % 60; return m > 0 ? `${m}m ${sec}s` : `${sec}s`; }

function ScreenshotCard({ cmd }: { cmd: Cmd }) {
  const st = STATUS[cmd.status] ?? STATUS.pending;
  const isPending = ['pending', 'delivered', 'executing'].includes(cmd.status);
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
            download={`screenshot_${cmd.id.slice(0, 8)}.jpg`}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-xs px-3 py-1.5 rounded-full">
            <Download size={12} /> Save
          </a>
        </div>
      ) : isPending ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-400">
          <div className="w-10 h-10 border-4 border-cyan-100 border-t-cyan-500 rounded-full animate-spin" />
          <p className="text-sm">Capturing screen…</p>
          <p className="text-xs text-gray-400">Requires Accessibility Service enabled on device</p>
        </div>
      ) : result?.type === 'error' ? (
        <div className="flex items-center gap-2 px-4 py-6 text-red-500 text-sm">
          <AlertCircle size={16} /> {String(result.message ?? 'Failed')}
        </div>
      ) : (
        <div className="px-4 py-6 text-gray-400 text-sm">No result yet</div>
      )}
      <div className="px-4 py-2 text-gray-400 text-xs border-t border-gray-100">
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
    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Video size={14} className="text-purple-500" />
          <span className="text-sm font-semibold">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${st.dot}`} />
          <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
        </div>
      </div>

      {videoUrl ? (
        <div>
          <video src={videoUrl} controls className="w-full max-h-80 bg-black" />
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100">
            <span className="text-gray-400 text-xs">
              Duration: {fmtDuration(Number(result?.duration ?? 0))} ·{' '}
              {((Number(result?.size ?? 0)) / 1024 / 1024).toFixed(1)} MB
            </span>
            <a href={videoUrl} download={`recording_${cmd.id.slice(0, 8)}.mp4`}
              className="flex items-center gap-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs px-3 py-1.5 rounded-full">
              <Download size={12} /> Download
            </a>
          </div>
        </div>
      ) : isPending ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-400">
          <div className="w-10 h-10 border-4 border-purple-100 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-sm">{isStop ? 'Finalising recording…' : 'Waiting for device to accept…'}</p>
          {!isStop && <p className="text-xs text-gray-400">User must tap &quot;Allow&quot; on the device</p>}
        </div>
      ) : result?.type === 'ok' ? (
        <div className="flex items-center gap-2 px-4 py-6 text-green-600 text-sm">
          <Play size={14} /> {String(result.message ?? 'Recording started')}
        </div>
      ) : result?.type === 'error' ? (
        <div className="flex items-center gap-2 px-4 py-6 text-red-500 text-sm">
          <AlertCircle size={16} /> {String(result.message ?? 'Failed')}
        </div>
      ) : (
        <div className="px-4 py-6 text-gray-400 text-sm">No result yet</div>
      )}
      <div className="px-4 py-2 text-gray-400 text-xs border-t border-gray-100">
        {fmtTime(cmd.issuedAt)}{cmd.completedAt && ` · Done: ${fmtTime(cmd.completedAt)}`}
      </div>
    </div>
  );
}

export default function RemoteScreenshotPage() {
  const [devices,    setDevices]    = useState<Device[]>([]);
  const [selected,   setSelected]   = useState('');
  const [commands,   setCommands]   = useState<Cmd[]>([]);
  const [busySnap,   setBusySnap]   = useState(false);
  const [busyRec,    setBusyRec]    = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [activeTab,  setActiveTab]  = useState<'screenshot' | 'recording'>('screenshot');
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
      setCommands(
        (r.data as Cmd[]).filter((c) =>
          ['take_screenshot', 'start_screen_record', 'stop_screen_record'].includes(c.commandType)
        )
      );
    } catch {}
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetchCmds().finally(() => setLoading(false));
    pollRef.current = setInterval(fetchCmds, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected, fetchCmds]);

  const isRecording = (() => {
    const starts = commands.filter((c) => c.commandType === 'start_screen_record');
    const stops  = commands.filter((c) => c.commandType === 'stop_screen_record');
    if (starts.length === 0) return false;
    if (stops.length === 0) return ['completed', 'pending', 'delivered', 'executing'].includes(starts[0].status);
    return new Date(starts[0].issuedAt) > new Date(stops[0].issuedAt);
  })();

  async function capture() {
    if (!selected) return;
    setBusySnap(true);
    try {
      await userCommandsApi.issue(selected, 'take_screenshot');
      await fetchCmds();
      toast.success('Screenshot command sent');
    } catch { toast.error('Failed to send command'); }
    finally { setBusySnap(false); }
  }

  async function startRecording() {
    if (!selected) return;
    setBusyRec(true);
    try {
      await userCommandsApi.issue(selected, 'start_screen_record');
      await fetchCmds();
      toast.success('Recording command sent — tap Allow on the device');
    } catch { toast.error('Failed to send command'); }
    finally { setBusyRec(false); }
  }

  async function stopRecording() {
    if (!selected) return;
    setBusyRec(true);
    try {
      await userCommandsApi.issue(selected, 'stop_screen_record');
      await fetchCmds();
      toast.success('Stop command sent — finalising video…');
    } catch { toast.error('Failed to send command'); }
    finally { setBusyRec(false); }
  }

  const device      = devices.find((d) => d.deviceId === selected);
  const screenshots = commands.filter((c) => c.commandType === 'take_screenshot');
  const recCmds     = commands.filter((c) =>
    ['start_screen_record', 'stop_screen_record'].includes(c.commandType));

  return (
    <>
      <Header title="Screenshot & Recording" subtitle="Capture or record the child device screen" />
      <main className="flex-1 p-8 space-y-6">

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
            <button onClick={fetchCmds} className="ml-auto text-gray-400 hover:text-primary"><RefreshCw size={15} /></button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab('screenshot')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'screenshot'
                ? 'bg-white text-cyan-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Monitor size={15} />
            Screenshots
            {screenshots.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === 'screenshot' ? 'bg-cyan-100 text-cyan-600' : 'bg-gray-200 text-gray-500'
              }`}>{screenshots.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('recording')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'recording'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Video size={15} />
            Screen Recording
            {recCmds.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === 'recording' ? 'bg-purple-100 text-purple-600' : 'bg-gray-200 text-gray-500'
              }`}>{recCmds.length}</span>
            )}
          </button>
        </div>

        {/* Action button + info — changes per tab */}
        {activeTab === 'screenshot' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <button onClick={capture} disabled={busySnap || !selected}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 shadow-md">
                {busySnap ? <Loader size={16} className="animate-spin" /> : <Monitor size={16} />}
                Capture Screen
              </button>
            </div>
            <p className="text-xs text-gray-400 bg-cyan-50 border border-cyan-100 rounded-xl px-4 py-2.5">
              Silent capture via Accessibility Service (Android 11+). No dialog shown on device.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {isRecording ? (
                <button onClick={stopRecording} disabled={busyRec || !selected}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 shadow-md">
                  {busyRec ? <Loader size={16} className="animate-spin" /> : <Square size={16} />}
                  Stop Recording
                </button>
              ) : (
                <button onClick={startRecording} disabled={busyRec || !selected}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 shadow-md">
                  {busyRec ? <Loader size={16} className="animate-spin" /> : <Video size={16} />}
                  Start Recording
                </button>
              )}
              {isRecording && (
                <span className="flex items-center gap-1.5 text-red-500 text-sm font-semibold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-500" /> Recording in progress
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 bg-purple-50 border border-purple-100 rounded-xl px-4 py-2.5">
              User must tap &quot;Allow&quot; once on device. A notification is shown while recording.
            </p>
          </div>
        )}

        {/* List */}
        {loading ? <PageLoader /> : (
          <>
            {activeTab === 'screenshot' && (
              screenshots.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {screenshots.map((cmd) => <ScreenshotCard key={cmd.id} cmd={cmd} />)}
                </div>
              ) : (
                <div className="card text-center py-16 text-gray-400">
                  <Monitor size={40} className="mx-auto mb-3 opacity-30" />
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
                <div className="card text-center py-16 text-gray-400">
                  <Video size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No recordings yet. Click &quot;Start Recording&quot; above.</p>
                </div>
              )
            )}
          </>
        )}
      </main>
    </>
  );
}
