'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Shield, Loader, CheckCircle, AlertCircle, Wifi, WifiOff, RefreshCw,
  Lock, Ban, ShieldOff, Trash2, EyeOff, Eye,
} from 'lucide-react';
import Header from '@/components/Header';
import { devicesApi, userCommandsApi, userAppBlocksApi } from '@/lib/api';
import type { Device } from '@/types';
import PageLoader from '@/components/PageLoader';
import { toast } from 'sonner';

interface Cmd {
  id: string; commandType: string;
  status: string; result: string | null;
  issuedAt: string; completedAt: string | null;
}
interface AppBlock { id: string; packageName: string; appName: string; isBlocked: boolean; }

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
};

function fmtTime(s: string) {
  return new Date(s).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}

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

function StatusCard({ cmd }: { cmd: Cmd }) {
  const result    = parseResult(cmd.result);
  const st        = STATUS[cmd.status] ?? STATUS.pending;
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
            {result.type === 'error' ? <AlertCircle size={11} /> : <CheckCircle size={11} />}
            {String(result.message ?? JSON.stringify(result))}
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
  const [devices,  setDevices]  = useState<Device[]>([]);
  const [selected, setSelected] = useState('');
  const [commands, setCommands] = useState<Cmd[]>([]);
  const [blocks,   setBlocks]   = useState<AppBlock[]>([]);
  const [busy,     setBusy]     = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
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

  const fetchBlocks = useCallback(async () => {
    if (!selected) return;
    try {
      const r = await userAppBlocksApi.list(selected);
      setBlocks((r.data as AppBlock[]).filter((b) => b.isBlocked));
    } catch {}
  }, [selected]);

  const fetchCommands = useCallback(async () => {
    if (!selected) return;
    try {
      const r = await userCommandsApi.list(selected);
      setCommands(
        (r.data as Cmd[]).filter((c) =>
          ['lock_device', 'block_app', 'unblock_app', 'hide_app', 'show_app'].includes(c.commandType)
        )
      );
    } catch {}
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    Promise.all([fetchCommands(), fetchBlocks()]).finally(() => setLoading(false));
    pollRef.current = setInterval(fetchCommands, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected, fetchCommands, fetchBlocks]);

  async function sendCmd(type: string, payload?: Record<string, unknown>) {
    if (!selected) return;
    setBusy(type);
    try {
      await userCommandsApi.issue(selected, type, payload);
      await fetchCommands();
      const msgs: Record<string, string> = {
        lock_device: 'Lock command sent',
        hide_app: 'Hide command sent — icon will disappear within 10 seconds',
        show_app: 'Show command sent — icon will reappear within 10 seconds',
      };
      toast.success(msgs[type] ?? 'Command sent');
    } catch { toast.error('Failed to send command'); }
    finally { setBusy(null); }
  }

  async function lockDevice() { return sendCmd('lock_device'); }

  async function blockApp() {
    const pkg = pkgInput.trim();
    if (!pkg || !selected) return;
    setBusy('block_' + pkg);
    try {
      await userAppBlocksApi.create({ deviceId: selected, packageName: pkg, appName: pkg, isBlocked: true });
      await userCommandsApi.issue(selected, 'block_app', { packageName: pkg });
      await Promise.all([fetchCommands(), fetchBlocks()]);
      toast.success(`Blocking ${pkg}`);
    } catch { toast.error('Failed to block app'); }
    finally { setBusy(null); }
  }

  async function unblockApp() {
    const pkg = pkgInput.trim();
    if (!pkg || !selected) return;
    const existing = blocks.find((b) => b.packageName === pkg);
    setBusy('unblock_' + pkg);
    try {
      if (existing) await userAppBlocksApi.delete(existing.id);
      await userCommandsApi.issue(selected, 'unblock_app', { packageName: pkg });
      await Promise.all([fetchCommands(), fetchBlocks()]);
      toast.success(`Unblocking ${pkg}`);
    } catch { toast.error('Failed to unblock app'); }
    finally { setBusy(null); }
  }

  async function unblockDirect(block: AppBlock) {
    if (!selected) return;
    setBusy('unblock_' + block.packageName);
    try {
      await userAppBlocksApi.delete(block.id);
      await userCommandsApi.issue(selected, 'unblock_app', { packageName: block.packageName });
      await Promise.all([fetchCommands(), fetchBlocks()]);
      toast.success(`Unblocked ${block.appName || block.packageName}`);
    } catch { toast.error('Failed to unblock'); }
    finally { setBusy(null); }
  }

  const device  = devices.find((d) => d.deviceId === selected);
  const isBusy  = !!busy;

  return (
    <>
      <Header title="Quick Commands" subtitle="Lock device and manage app access" />

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
            <button onClick={() => Promise.all([fetchCommands(), fetchBlocks()])}
              className="ml-auto text-gray-400 hover:text-primary"><RefreshCw size={15} /></button>
          </div>
        </div>

        {/* ── App Visibility ────────────────────────────────────────────────── */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <EyeOff size={16} className="text-purple-500" />
            <h3 className="font-semibold text-gray-800">App Visibility</h3>
            {device && (
              <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
                (device as Device & { appHidden?: boolean }).appHidden
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : 'bg-green-100 text-green-700 border border-green-200'
              }`}>
                {(device as Device & { appHidden?: boolean }).appHidden ? 'Hidden' : 'Visible'}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">
            Remotely hide or show the ParentGard icon on your child&apos;s device. Tracking continues
            even when the icon is hidden.
          </p>
          <div className="flex gap-2">
            <button onClick={() => sendCmd('hide_app')} disabled={isBusy || !selected}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 shadow-md">
              {busy === 'hide_app' ? <Loader size={16} className="animate-spin" /> : <EyeOff size={16} />}
              Hide Icon
            </button>
            <button onClick={() => sendCmd('show_app')} disabled={isBusy || !selected}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 shadow-md">
              {busy === 'show_app' ? <Loader size={16} className="animate-spin" /> : <Eye size={16} />}
              Show Icon
            </button>
          </div>
        </div>

        {/* ── Lock Device ──────────────────────────────────────────────────── */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-red-500" />
            <h3 className="font-semibold text-gray-800">Lock Device</h3>
          </div>
          <p className="text-xs text-gray-400">
            Immediately locks the screen using the Accessibility Service.
          </p>
          <button onClick={lockDevice} disabled={isBusy || !selected}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 shadow-md">
            {busy === 'lock_device' ? <Loader size={16} className="animate-spin" /> : <Lock size={16} />}
            Lock Device Now
          </button>
        </div>

        {/* ── Block / Unblock App ──────────────────────────────────────────── */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <Ban size={16} className="text-orange-500" />
            <h3 className="font-semibold text-gray-800">Block / Unblock App</h3>
          </div>

          {/* Currently blocked panel */}
          {blocks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Currently Blocked ({blocks.length})
              </p>
              <div className="space-y-1.5">
                {blocks.map((b) => (
                  <div key={b.id}
                    className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    <div>
                      <p className="text-red-700 text-sm font-semibold">{b.appName || b.packageName}</p>
                      <p className="text-red-400 text-xs font-mono">{b.packageName}</p>
                    </div>
                    <button onClick={() => unblockDirect(b)} disabled={isBusy}
                      title="Unblock"
                      className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 bg-green-100 hover:bg-green-200 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50">
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

          {/* Package name input */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Package Name
            </label>
            <input value={pkgInput} onChange={(e) => setPkgInput(e.target.value)}
              className="input w-full font-mono" placeholder="com.whatsapp" />
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
                      ? 'bg-indigo-100 border-indigo-300 text-indigo-700 font-semibold'
                      : alreadyBlocked
                        ? 'bg-red-50 border-red-200 text-red-500'
                        : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'}`}>
                  {alreadyBlocked && '🚫 '}{a.name}
                </button>
              );
            })}
          </div>

          {/* Block / Unblock buttons */}
          <div className="flex gap-2">
            <button onClick={blockApp} disabled={isBusy || !pkgInput.trim() || !selected}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm disabled:opacity-50 transition-colors">
              {busy === 'block_' + pkgInput.trim()
                ? <Loader size={14} className="animate-spin" />
                : <Ban size={14} />}
              Block
            </button>
            <button onClick={unblockApp} disabled={isBusy || !pkgInput.trim() || !selected}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm disabled:opacity-50 transition-colors">
              {busy === 'unblock_' + pkgInput.trim()
                ? <Loader size={14} className="animate-spin" />
                : <ShieldOff size={14} />}
              Unblock
            </button>
          </div>
        </div>

        {/* ── Command History ──────────────────────────────────────────────── */}
        {loading ? <PageLoader /> : commands.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">
            <Shield size={36} className="mx-auto mb-3 opacity-30" />
            <p>No commands sent yet.</p>
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
