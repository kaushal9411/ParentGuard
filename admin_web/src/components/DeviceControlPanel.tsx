'use client';
import { useState } from 'react';
import { Power, Loader, Volume2, VolumeX, Wifi, WifiOff, Signal, SignalZero } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Reusable device-control panel (reboot + future power/system controls).
 * Shared by the parent dashboard and the admin console — pass the relevant
 * `onIssue` (userCommandsApi.issue / adminApi.issueCommand).
 */
export default function DeviceControlPanel({
  disabled = false,
  theme = 'light',
  onIssue,
}: {
  disabled?: boolean;
  theme?: 'light' | 'dark';
  onIssue: (commandType: string, payload?: Record<string, unknown>) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const dark = theme === 'dark';
  const card = dark ? 'bg-gray-900 border border-gray-800 rounded-2xl p-5' : 'card space-y-3';
  const head = dark ? 'text-white font-bold' : 'font-semibold text-gray-800';
  const sub  = dark ? 'text-gray-500 text-xs' : 'text-xs text-gray-400';

  async function run(key: string, type: string, okMsg: string, confirmMsg?: string, payload?: Record<string, unknown>) {
    if (disabled) return;
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(key);
    try { await onIssue(type, payload); toast.success(okMsg); }
    catch { toast.error('Failed — device may not support this on its plan / privileges'); }
    finally { setBusy(null); }
  }

  const btn = 'flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-all active:scale-95 disabled:opacity-60';

  return (
    <div className="space-y-6">
      {/* ── Power ─────────────────────────────────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-2">
          <Power size={16} className="text-slate-500" />
          <h3 className={head}>Power</h3>
        </div>
        <p className={sub}>
          Reboot the device remotely. Requires the app to be set up as device owner
          on the child&apos;s phone.
        </p>
        <button
          onClick={() => run('reboot_device', 'reboot_device', 'Reboot command sent', 'Reboot the device now?')}
          disabled={disabled || !!busy}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60">
          {busy === 'reboot_device' ? <Loader size={16} className="animate-spin" /> : <Power size={16} />}
          Reboot Device
        </button>
      </div>

      {/* ── Volume ────────────────────────────────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-2">
          <Volume2 size={16} className="text-emerald-500" />
          <h3 className={head}>Volume</h3>
        </div>
        <p className={sub}>Set the device media, ring and alarm volume.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => run('vol_mute', 'set_volume', 'Muted', undefined, { percent: 0 })}
            disabled={disabled || !!busy}
            className={`${btn} bg-gray-600 hover:bg-gray-700`}>
            {busy === 'vol_mute' ? <Loader size={15} className="animate-spin" /> : <VolumeX size={15} />} Mute
          </button>
          {[30, 60, 100].map((p) => (
            <button key={p}
              onClick={() => run(`vol_${p}`, 'set_volume', `Volume ${p}%`, undefined, { percent: p })}
              disabled={disabled || !!busy}
              className={`${btn} bg-emerald-600 hover:bg-emerald-700`}>
              {busy === `vol_${p}` ? <Loader size={15} className="animate-spin" /> : <Volume2 size={15} />}
              {p === 100 ? 'Max' : `${p}%`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Wi-Fi ─────────────────────────────────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-2">
          <Wifi size={16} className="text-blue-500" />
          <h3 className={head}>Wi-Fi</h3>
        </div>
        <p className={sub}>
          Android 10+ blocks silent toggling — the device will open its Wi-Fi panel for a tap.
        </p>
        <div className="flex gap-2">
          <button onClick={() => run('wifi_on', 'set_wifi', 'Wi-Fi command sent', undefined, { enabled: true })}
            disabled={disabled || !!busy} className={`${btn} bg-blue-600 hover:bg-blue-700`}>
            {busy === 'wifi_on' ? <Loader size={15} className="animate-spin" /> : <Wifi size={15} />} Turn On
          </button>
          <button onClick={() => run('wifi_off', 'set_wifi', 'Wi-Fi command sent', undefined, { enabled: false })}
            disabled={disabled || !!busy} className={`${btn} bg-gray-600 hover:bg-gray-700`}>
            {busy === 'wifi_off' ? <Loader size={15} className="animate-spin" /> : <WifiOff size={15} />} Turn Off
          </button>
        </div>
      </div>

      {/* ── Mobile data ───────────────────────────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-2">
          <Signal size={16} className="text-violet-500" />
          <h3 className={head}>Mobile Data</h3>
        </div>
        <p className={sub}>
          Heavily OS-restricted — works only on devices/ROMs that permit it; otherwise reports a restriction.
        </p>
        <div className="flex gap-2">
          <button onClick={() => run('data_on', 'set_mobile_data', 'Mobile-data command sent', undefined, { enabled: true })}
            disabled={disabled || !!busy} className={`${btn} bg-violet-600 hover:bg-violet-700`}>
            {busy === 'data_on' ? <Loader size={15} className="animate-spin" /> : <Signal size={15} />} Turn On
          </button>
          <button onClick={() => run('data_off', 'set_mobile_data', 'Mobile-data command sent', undefined, { enabled: false })}
            disabled={disabled || !!busy} className={`${btn} bg-gray-600 hover:bg-gray-700`}>
            {busy === 'data_off' ? <Loader size={15} className="animate-spin" /> : <SignalZero size={15} />} Turn Off
          </button>
        </div>
      </div>
    </div>
  );
}
