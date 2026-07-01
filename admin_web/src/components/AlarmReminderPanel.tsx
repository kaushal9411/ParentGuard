'use client';
import { useState } from 'react';
import { AlarmClock, BellRing, Loader } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Reusable panel for scheduling a remote alarm or reminder on a child device.
 * Works for both the parent dashboard and the admin console — just pass the
 * relevant `issue` function (userCommandsApi.issue / adminApi.issueCommand).
 *
 * `theme="dark"` matches the admin console styling; default is the light
 * parent-dashboard styling.
 */
export default function AlarmReminderPanel({
  disabled = false,
  theme = 'light',
  onIssue,
}: {
  disabled?: boolean;
  theme?: 'light' | 'dark';
  onIssue: (commandType: string, payload: Record<string, unknown>) => Promise<void>;
}) {
  const [alarmTime,  setAlarmTime]  = useState('');
  const [alarmLabel, setAlarmLabel] = useState('');
  const [remTime,    setRemTime]    = useState('');
  const [remTitle,   setRemTitle]   = useState('');
  const [remMessage, setRemMessage] = useState('');
  const [busy,       setBusy]       = useState<string | null>(null);

  const dark = theme === 'dark';
  const card  = dark ? 'bg-gray-900 border border-gray-800 rounded-2xl p-5' : 'card space-y-3';
  const head  = dark ? 'text-white font-bold' : 'font-semibold text-gray-800';
  const sub   = dark ? 'text-gray-500 text-xs' : 'text-xs text-gray-400';
  const label = dark
    ? 'text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1 block'
    : 'text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block';
  const inputCls = dark
    ? 'w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500'
    : 'input w-full';

  async function schedule(kind: 'alarm' | 'reminder') {
    const time = kind === 'alarm' ? alarmTime : remTime;
    if (!time) { toast.error('Pick a date & time'); return; }
    const triggerAt = new Date(time).getTime();
    if (isNaN(triggerAt)) { toast.error('Invalid date & time'); return; }
    if (triggerAt <= Date.now()) { toast.error('Pick a time in the future'); return; }

    const payload: Record<string, unknown> =
      kind === 'alarm'
        ? { triggerAt, label: alarmLabel.trim() || 'Alarm' }
        : { triggerAt, title: remTitle.trim() || 'Reminder', message: remMessage.trim() };

    setBusy(kind);
    try {
      await onIssue(kind === 'alarm' ? 'set_alarm' : 'set_reminder', payload);
      toast.success(
        `${kind === 'alarm' ? 'Alarm' : 'Reminder'} scheduled for ` +
        new Date(triggerAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
      );
      if (kind === 'alarm') { setAlarmTime(''); setAlarmLabel(''); }
      else { setRemTime(''); setRemTitle(''); setRemMessage(''); }
    } catch {
      toast.error('Failed to schedule — device may not support remote commands on this plan');
    } finally {
      setBusy(null);
    }
  }

  const isBusy = !!busy || disabled;

  return (
    <div className={dark ? 'space-y-6' : 'space-y-6'}>
      {/* ── Alarm ─────────────────────────────────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-2">
          <AlarmClock size={16} className="text-amber-500" />
          <h3 className={head}>Set Alarm</h3>
        </div>
        <p className={sub}>
          Rings the child&apos;s device with a full-screen alert and sound at the chosen time —
          even if the screen is locked.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>Date &amp; Time</label>
            <input type="datetime-local" value={alarmTime}
              onChange={(e) => setAlarmTime(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={label}>Label (optional)</label>
            <input value={alarmLabel} onChange={(e) => setAlarmLabel(e.target.value)}
              placeholder="Wake up" className={inputCls} />
          </div>
        </div>
        <button onClick={() => schedule('alarm')} disabled={isBusy}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60">
          {busy === 'alarm' ? <Loader size={16} className="animate-spin" /> : <AlarmClock size={16} />}
          Set Alarm
        </button>
      </div>

      {/* ── Reminder ──────────────────────────────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-2">
          <BellRing size={16} className="text-indigo-500" />
          <h3 className={head}>Set Reminder</h3>
        </div>
        <p className={sub}>
          Sends a notification with your message to the child&apos;s device at the chosen time.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>Date &amp; Time</label>
            <input type="datetime-local" value={remTime}
              onChange={(e) => setRemTime(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={label}>Title (optional)</label>
            <input value={remTitle} onChange={(e) => setRemTitle(e.target.value)}
              placeholder="Homework" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={label}>Message</label>
          <input value={remMessage} onChange={(e) => setRemMessage(e.target.value)}
            placeholder="Finish your maths assignment" className={inputCls} />
        </div>
        <button onClick={() => schedule('reminder')} disabled={isBusy}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60">
          {busy === 'reminder' ? <Loader size={16} className="animate-spin" /> : <BellRing size={16} />}
          Set Reminder
        </button>
      </div>
    </div>
  );
}
