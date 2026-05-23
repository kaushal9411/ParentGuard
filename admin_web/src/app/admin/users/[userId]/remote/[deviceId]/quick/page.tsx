'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Shield, Loader, CheckCircle, AlertCircle, Lock, RefreshCw,
  Wifi, WifiOff, Ban, ShieldOff, Clock, Trash2,
} from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import PageLoader from '@/components/PageLoader';
import { toast } from 'sonner';

interface Cmd { id: string; commandType: string; status: string; result: string | null; issuedAt: string; }
interface DeviceInfo { deviceId: string; name: string; isOnline: boolean; }
interface AppBlock { id: string; packageName: string; appName: string; isBlocked: boolean; }

function parseResult(raw: string | null) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function fmtTime(s: string) {
  return new Date(s).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}

const STATUS: Record<string, { label: string; color: string; dot: string }> = {
  pending:   { label: 'Waiting…',  color: 'text-yellow-400', dot: 'bg-yellow-400 animate-pulse' },
  delivered: { label: 'Delivered', color: 'text-blue-400',   dot: 'bg-blue-400 animate-pulse' },
  executing: { label: 'Running…',  color: 'text-indigo-400', dot: 'bg-indigo-400 animate-pulse' },
  completed: { label: 'Done',      color: 'text-green-400',  dot: 'bg-green-400' },
  failed:    { label: 'Failed',    color: 'text-red-400',    dot: 'bg-red-500' },
};

const POPULAR_APPS = [
  { name: 'WhatsApp',   pkg: 'com.whatsapp' },
  { name: 'Instagram',  pkg: 'com.instagram.android' },
  { name: 'YouTube',    pkg: 'com.google.android.youtube' },
  { name: 'TikTok',     pkg: 'com.zhiliaoapp.musically' },
  { name: 'Snapchat',   pkg: 'com.snapchat.android' },
  { name: 'BGMI',       pkg: 'com.pubg.imobile' },
  { name: 'Free Fire',  pkg: 'com.dts.freefireth' },
  { name: 'Facebook',   pkg: 'com.facebook.katana' },
  { name: 'Twitter/X',  pkg: 'com.twitter.android' },
  { name: 'Telegram',   pkg: 'org.telegram.messenger' },
];

function CmdCard({ cmd }: { cmd: Cmd }) {
  const result = parseResult(cmd.result);
  const st = STATUS[cmd.status] ?? STATUS.pending;
  const isOk = result?.type === 'ok' || result?.type === 'status';
  const isErr = result?.type === 'error';
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-start justify-between gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Lock size={13} className="text-indigo-400 flex-shrink-0" />
          <span className="text-white text-sm font-semibold capitalize">{cmd.commandType.replace(/_/g, ' ')}</span>
        </div>
        {result && (
          <p className={`text-xs mt-1 flex items-center gap-1 ${isErr ? 'text-red-400' : 'text-green-400'}`}>
            {isErr ? <AlertCircle size={11} /> : <CheckCircle size={11} />}
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

  const [device,   setDevice]   = useState<DeviceInfo | null>(null);
  const [commands, setCommands] = useState<Cmd[]>([]);
  const [blocks,   setBlocks]   = useState<AppBlock[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [busy,     setBusy]     = useState<string | null>(null);
  const [pkgInput, setPkgInput] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    adminApi.userDetail(userId).then((r) => {
      setDevice(r.data.devices?.find((d: DeviceInfo) => d.deviceId === deviceId) ?? null);
    }).catch(() => {});
  }, [userId, deviceId]);

  const fetchBlocks = useCallback(async () => {
    try {
      const r = await adminApi.deviceAppBlocks(deviceId);
      setBlocks((r.data as AppBlock[]).filter((b) => b.isBlocked));
    } catch {}
  }, [deviceId]);

  const fetchCmds = useCallback(async () => {
    try {
      const r = await adminApi.deviceCommands(deviceId);
      setCommands((r.data as Cmd[]).filter((c) =>
        ['lock_device', 'block_app', 'unblock_app'].includes(c.commandType)));
    } catch {}
  }, [deviceId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchCmds(), fetchBlocks()]).finally(() => setLoading(false));
    pollRef.current = setInterval(fetchCmds, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchCmds, fetchBlocks]);

  async function send(type: string, payload?: Record<string, unknown>) {
    const key = type + (payload?.packageName ? '_' + payload.packageName : '');
    setBusy(key);
    try {
      await adminApi.issueCommand(deviceId, type, payload);
      await Promise.all([fetchCmds(), fetchBlocks()]);
      toast.success(
        type === 'lock_device' ? 'Lock command sent' :
        type === 'block_app'   ? `Blocking ${payload?.packageName}` :
                                 `Unblocking ${payload?.packageName}`
      );
    } catch {
      toast.error('Failed to send command');
    } finally {
      setBusy(null);
    }
  }

  async function unblockDirect(block: AppBlock) {
    setBusy('unblock_' + block.packageName);
    try {
      await adminApi.issueCommand(deviceId, 'unblock_app', { packageName: block.packageName });
      await adminApi.deleteAppBlock(block.id);
      await Promise.all([fetchCmds(), fetchBlocks()]);
      toast.success(`Unblocked ${block.appName || block.packageName}`);
    } catch {
      toast.error('Failed to unblock');
    } finally {
      setBusy(null);
    }
  }

  const isBusy = !!busy;

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
          <button onClick={() => Promise.all([fetchCmds(), fetchBlocks()])}
            className="text-gray-600 hover:text-gray-300 transition-colors">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">

        {/* ── Lock Device ──────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lock size={16} className="text-red-400" />
            <h3 className="text-white font-bold">Lock Device</h3>
          </div>
          <p className="text-gray-500 text-xs mb-4">
            Immediately locks the screen. Requires Accessibility Service to be enabled on the device.
          </p>
          <button
            onClick={() => send('lock_device')}
            disabled={isBusy}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-bold text-sm transition-all active:scale-95 shadow-lg">
            {busy === 'lock_device'
              ? <Loader size={16} className="animate-spin" />
              : <Lock size={16} />}
            Lock Device Now
          </button>
        </div>

        {/* ── Block / Unblock App ──────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Ban size={16} className="text-orange-400" />
            <h3 className="text-white font-bold">Block / Unblock App</h3>
          </div>

          {/* Currently blocked apps */}
          {blocks.length > 0 && (
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">
                Currently Blocked ({blocks.length})
              </p>
              <div className="space-y-1.5">
                {blocks.map((b) => (
                  <div key={b.id}
                    className="flex items-center justify-between bg-red-950/40 border border-red-900/40 rounded-xl px-3 py-2">
                    <div>
                      <p className="text-red-300 text-sm font-semibold">{b.appName || b.packageName}</p>
                      <p className="text-red-500/70 text-xs font-mono">{b.packageName}</p>
                    </div>
                    <button
                      onClick={() => unblockDirect(b)}
                      disabled={isBusy}
                      title="Unblock"
                      className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 bg-green-900/20 hover:bg-green-900/40 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                      {busy === 'unblock_' + b.packageName
                        ? <Loader size={11} className="animate-spin" />
                        : <ShieldOff size={11} />}
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div>
            <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1.5 block">
              Package Name
            </label>
            <input
              value={pkgInput}
              onChange={(e) => setPkgInput(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 font-mono"
              placeholder="com.whatsapp" />
          </div>

          {/* Popular app chips */}
          <div className="flex gap-1.5 flex-wrap">
            {POPULAR_APPS.map((a) => {
              const alreadyBlocked = blocks.some((b) => b.packageName === a.pkg);
              return (
                <button key={a.pkg} type="button"
                  onClick={() => setPkgInput(a.pkg)}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-colors border
                    ${pkgInput === a.pkg
                      ? 'bg-indigo-700 border-indigo-500 text-white'
                      : alreadyBlocked
                        ? 'bg-red-900/30 border-red-800/50 text-red-400'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
                  {alreadyBlocked && '🚫 '}{a.name}
                </button>
              );
            })}
          </div>

          {/* Block / Unblock buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => { if (pkgInput.trim()) send('block_app', { packageName: pkgInput.trim() }); }}
              disabled={isBusy || !pkgInput.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white font-semibold text-sm disabled:opacity-50 transition-colors">
              {busy === 'block_app_' + pkgInput.trim()
                ? <Loader size={14} className="animate-spin" />
                : <Ban size={14} />}
              Block
            </button>
            <button
              onClick={() => { if (pkgInput.trim()) send('unblock_app', { packageName: pkgInput.trim() }); }}
              disabled={isBusy || !pkgInput.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-700 hover:bg-green-600 text-white font-semibold text-sm disabled:opacity-50 transition-colors">
              {busy === 'unblock_app_' + pkgInput.trim()
                ? <Loader size={14} className="animate-spin" />
                : <ShieldOff size={14} />}
              Unblock
            </button>
          </div>
        </div>

        {/* ── Command History ──────────────────────────────────────────── */}
        {loading ? <PageLoader theme="dark" /> : commands.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <Clock size={36} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">No commands sent yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">
              Command History
            </p>
            {commands.map((cmd) => <CmdCard key={cmd.id} cmd={cmd} />)}
          </div>
        )}

      </div>
    </div>
  );
}
