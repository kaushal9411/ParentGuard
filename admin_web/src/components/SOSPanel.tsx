'use client';
import { useState } from 'react';
import {
  Siren, BellRing, Lock, MapPin, Navigation, Crosshair,
  MessageSquare, Send, Loader, Volume2,
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * Reusable SOS / emergency remote-actions panel. Works for both the parent
 * dashboard and the admin console — pass the relevant `onIssue` (device command)
 * and `getLastLocation` (for "navigate to child") functions.
 */
export default function SOSPanel({
  disabled = false,
  theme = 'light',
  onIssue,
  getLastLocation,
}: {
  disabled?: boolean;
  theme?: 'light' | 'dark';
  onIssue: (commandType: string, payload?: Record<string, unknown>) => Promise<void>;
  getLastLocation: () => Promise<{ latitude: number; longitude: number } | null>;
}) {
  const [busy,     setBusy]     = useState<string | null>(null);
  const [emMsg,    setEmMsg]    = useState('');
  const [notifMsg, setNotifMsg] = useState('');

  const dark  = theme === 'dark';
  const card  = dark ? 'bg-gray-900 border border-gray-800 rounded-2xl p-5' : 'card space-y-3';
  const head  = dark ? 'text-white font-bold' : 'font-semibold text-gray-800';
  const sub   = dark ? 'text-gray-500 text-xs' : 'text-xs text-gray-400';
  const inputCls = dark
    ? 'w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500'
    : 'input w-full';

  async function run(key: string, fn: () => Promise<void>) {
    if (disabled) return;
    setBusy(key);
    try { await fn(); }
    catch { toast.error('Failed — device may not support remote commands on this plan'); }
    finally { setBusy(null); }
  }

  function cmd(key: string, type: string, payload?: Record<string, unknown>, okMsg?: string) {
    return run(key, async () => {
      await onIssue(type, payload);
      toast.success(okMsg ?? 'Command sent');
    });
  }

  async function navigate() {
    await run('navigate', async () => {
      const loc = await getLastLocation();
      if (!loc) { toast.error('No recent location for this device yet'); return; }
      const url = `https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}`;
      window.open(url, '_blank', 'noopener');
      toast.success('Opening navigation to child’s location');
    });
  }

  const ACTIONS: {
    key: string; label: string; desc: string; icon: React.ElementType;
    color: string; onClick: () => void;
  }[] = [
    { key: 'sos_alarm', label: 'Trigger SOS Alarm', desc: 'Loud emergency siren + full-screen alert',
      icon: Siren, color: 'bg-red-600 hover:bg-red-700',
      onClick: () => cmd('sos_alarm', 'sos_alarm', undefined, 'SOS alarm triggered') },
    { key: 'ring_device', label: 'Ring Phone', desc: 'Rings loudly even if on silent',
      icon: Volume2, color: 'bg-orange-600 hover:bg-orange-700',
      onClick: () => cmd('ring_device', 'ring_device', undefined, 'Ringing the phone') },
    { key: 'lock_device', label: 'Lock Device', desc: 'Locks the screen immediately',
      icon: Lock, color: 'bg-rose-600 hover:bg-rose-700',
      onClick: () => cmd('lock_device', 'lock_device', undefined, 'Lock command sent') },
    { key: 'request_location', label: 'Request Location', desc: 'Immediate high-accuracy GPS update',
      icon: MapPin, color: 'bg-blue-600 hover:bg-blue-700',
      onClick: () => cmd('request_location', 'request_location', undefined, 'Location update requested') },
    { key: 'navigate', label: 'Navigate to Child', desc: 'Open maps directions to last location',
      icon: Navigation, color: 'bg-teal-600 hover:bg-teal-700', onClick: navigate },
    { key: 'high_accuracy_location', label: 'High-Accuracy Mode', desc: 'Prompt to enable precise GPS (consent)',
      icon: Crosshair, color: 'bg-indigo-600 hover:bg-indigo-700',
      onClick: () => cmd('high_accuracy_location', 'high_accuracy_location', undefined, 'High-accuracy request sent') },
  ];

  return (
    <div className="space-y-6">
      {/* ── Quick emergency actions grid ──────────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-2">
          <Siren size={16} className="text-red-500" />
          <h3 className={head}>Emergency Actions</h3>
        </div>
        <p className={sub}>One-tap remote actions for urgent situations.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <button key={a.key} onClick={a.onClick} disabled={disabled || !!busy}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-white text-left transition-all active:scale-95 disabled:opacity-50 ${a.color}`}>
                {busy === a.key ? <Loader size={18} className="animate-spin flex-shrink-0" /> : <Icon size={18} className="flex-shrink-0" />}
                <span className="min-w-0">
                  <span className="block text-sm font-bold leading-tight">{a.label}</span>
                  <span className="block text-[11px] opacity-90 leading-tight">{a.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Emergency message on lock screen ──────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-amber-500" />
          <h3 className={head}>Emergency Message</h3>
        </div>
        <p className={sub}>Displays a full-screen message on the child&apos;s device — even when locked.</p>
        <input value={emMsg} onChange={(e) => setEmMsg(e.target.value)}
          placeholder="Call me right now" className={inputCls} />
        <button
          onClick={() => {
            if (!emMsg.trim()) { toast.error('Enter a message'); return; }
            cmd('emergency_message', 'emergency_message',
              { title: 'Emergency Message', message: emMsg.trim() }, 'Emergency message sent')
              .then(() => setEmMsg(''));
          }}
          disabled={disabled || !!busy}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60">
          {busy === 'emergency_message' ? <Loader size={16} className="animate-spin" /> : <MessageSquare size={16} />}
          Show on Lock Screen
        </button>
      </div>

      {/* ── Send a notification to the child ──────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-2">
          <BellRing size={16} className="text-indigo-500" />
          <h3 className={head}>Send Notification</h3>
        </div>
        <p className={sub}>Sends a message with a tone to the child&apos;s device.</p>
        <input value={notifMsg} onChange={(e) => setNotifMsg(e.target.value)}
          placeholder="Are you okay?" className={inputCls} />
        <button
          onClick={() => {
            if (!notifMsg.trim()) { toast.error('Enter a message'); return; }
            cmd('send_notification', 'send_notification',
              { title: 'Message from Parent', message: notifMsg.trim() }, 'Notification sent')
              .then(() => setNotifMsg(''));
          }}
          disabled={disabled || !!busy}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60">
          {busy === 'send_notification' ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
          Send Notification
        </button>
      </div>
    </div>
  );
}
