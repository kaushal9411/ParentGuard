'use client';
import { AlarmClock, BellRing, CheckCircle, AlertCircle, Clock } from 'lucide-react';

export interface AlarmCmd {
  id: string;
  commandType: string;      // 'set_alarm' | 'set_reminder'
  payload: string | null;   // JSON string
  status: string;
  result: string | null;
  issuedAt: string;
  completedAt: string | null;
}

const STATUS: Record<string, { label: string; color: string; dot: string }> = {
  pending:   { label: 'Queued',    color: 'text-yellow-500', dot: 'bg-yellow-400 animate-pulse' },
  delivered: { label: 'Delivered', color: 'text-blue-500',   dot: 'bg-blue-400 animate-pulse' },
  executing: { label: 'Setting…',  color: 'text-indigo-500', dot: 'bg-indigo-400 animate-pulse' },
  completed: { label: 'Scheduled', color: 'text-green-500',  dot: 'bg-green-500' },
  failed:    { label: 'Failed',    color: 'text-red-500',    dot: 'bg-red-500' },
  cancelled: { label: 'Cancelled', color: 'text-gray-400',   dot: 'bg-gray-400' },
};

function parse(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
}
function fmt(ms: number) {
  return new Date(ms).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AlarmReminderList({
  commands,
  theme = 'light',
}: {
  commands: AlarmCmd[];
  theme?: 'light' | 'dark';
}) {
  const dark = theme === 'dark';

  const items = commands.filter(
    (c) => c.commandType === 'set_alarm' || c.commandType === 'set_reminder',
  );

  if (items.length === 0) {
    return (
      <div className={`text-center py-12 ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
        <Clock size={36} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">No alarms or reminders set yet.</p>
      </div>
    );
  }

  const cardCls = dark
    ? 'bg-gray-900 border border-gray-800 rounded-xl px-4 py-3'
    : 'card py-3';

  return (
    <div className="space-y-2">
      {items.map((c) => {
        const isAlarm = c.commandType === 'set_alarm';
        const p       = parse(c.payload);
        const result  = parse(c.result);
        const st      = STATUS[c.status] ?? STATUS.pending;
        const triggerAt = typeof p.triggerAt === 'number' ? p.triggerAt : 0;
        const title   = (p.label as string) || (p.title as string) ||
          (isAlarm ? 'Alarm' : 'Reminder');
        const message = (p.message as string) || '';
        const isErr   = result?.type === 'error';
        const Icon    = isAlarm ? AlarmClock : BellRing;

        return (
          <div key={c.id} className={`${cardCls} flex items-start justify-between gap-4`}>
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isAlarm
                  ? (dark ? 'bg-amber-500/20' : 'bg-amber-100')
                  : (dark ? 'bg-indigo-500/20' : 'bg-indigo-100')
              }`}>
                <Icon size={17} className={isAlarm ? 'text-amber-500' : 'text-indigo-500'} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-800'}`}>
                    {title}
                  </span>
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                    isAlarm
                      ? (dark ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-50 text-amber-600')
                      : (dark ? 'bg-indigo-900/40 text-indigo-300' : 'bg-indigo-50 text-indigo-600')
                  }`}>
                    {isAlarm ? 'Alarm' : 'Reminder'}
                  </span>
                </div>
                {message && (
                  <p className={`text-xs mt-0.5 truncate ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {message}
                  </p>
                )}
                {triggerAt > 0 && (
                  <p className={`text-xs mt-0.5 flex items-center gap-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                    <Clock size={11} /> {fmt(triggerAt)}
                  </p>
                )}
                {result && (result.message as string) && (
                  <p className={`text-xs mt-1 flex items-center gap-1 ${isErr ? 'text-red-500' : 'text-green-600'}`}>
                    {isErr ? <AlertCircle size={11} /> : <CheckCircle size={11} />}
                    {String(result.message)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`w-2 h-2 rounded-full ${st.dot}`} />
              <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
