'use client';
import { Zap, CheckCircle, AlertCircle, Clock } from 'lucide-react';

export interface HistoryCmd {
  id: string;
  commandType: string;
  status: string;
  result: string | null;
  issuedAt: string;
}

const STATUS: Record<string, { label: string; color: string; dot: string }> = {
  pending:   { label: 'Waiting…',  color: 'text-yellow-500', dot: 'bg-yellow-400 animate-pulse' },
  delivered: { label: 'Delivered', color: 'text-blue-500',   dot: 'bg-blue-400 animate-pulse' },
  executing: { label: 'Running…',  color: 'text-indigo-500', dot: 'bg-indigo-400 animate-pulse' },
  completed: { label: 'Done',      color: 'text-green-500',  dot: 'bg-green-500' },
  failed:    { label: 'Failed',    color: 'text-red-500',    dot: 'bg-red-500' },
  cancelled: { label: 'Cancelled', color: 'text-gray-400',   dot: 'bg-gray-400' },
};

function parseResult(raw: string | null) {
  if (!raw) return null;
  try { return JSON.parse(raw) as { type?: string; message?: string }; } catch { return null; }
}
function fmt(s: string) {
  return new Date(s).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}

export default function CommandHistoryList({
  commands,
  theme = 'light',
}: {
  commands: HistoryCmd[];
  theme?: 'light' | 'dark';
}) {
  const dark = theme === 'dark';

  if (commands.length === 0) {
    return (
      <div className={`text-center py-12 ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
        <Clock size={36} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">No commands sent yet.</p>
      </div>
    );
  }

  const cardCls = dark
    ? 'bg-gray-900 border border-gray-800 rounded-xl px-4 py-3'
    : 'card py-3';

  return (
    <div className="space-y-2">
      {commands.map((c) => {
        const result = parseResult(c.result);
        const st     = STATUS[c.status] ?? STATUS.pending;
        const isErr  = result?.type === 'error';
        return (
          <div key={c.id} className={`${cardCls} flex items-start justify-between gap-4`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Zap size={13} className="text-indigo-500 flex-shrink-0" />
                <span className={`text-sm font-semibold capitalize ${dark ? 'text-white' : 'text-gray-800'}`}>
                  {c.commandType.replace(/_/g, ' ')}
                </span>
              </div>
              {result?.message && (
                <p className={`text-xs mt-1 flex items-center gap-1 ${isErr ? 'text-red-500' : 'text-green-600'}`}>
                  {isErr ? <AlertCircle size={11} /> : <CheckCircle size={11} />}
                  {String(result.message)}
                </p>
              )}
              <p className={`text-xs mt-1 ${dark ? 'text-gray-600' : 'text-gray-400'}`}>{fmt(c.issuedAt)}</p>
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
