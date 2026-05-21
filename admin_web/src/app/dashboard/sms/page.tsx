'use client';
import { useEffect, useState } from 'react';
import { MessageSquare, Search, Mail, Send } from 'lucide-react';
import Header from '@/components/Header';
import PageLoader from '@/components/PageLoader';
import { devicesApi, userSmsApi } from '@/lib/api';
import type { Device } from '@/types';

interface SmsItem {
  id: string; deviceId: string;
  address: string; body: string;
  type: number; date: string;
  isRead: boolean; threadId: string | null;
}

const SMS_TYPES: Record<number, { label: string; color: string; icon: React.ReactNode }> = {
  1: { label: 'Inbox',  color: 'bg-green-100 text-green-700',  icon: <Mail size={11} /> },
  2: { label: 'Sent',   color: 'bg-blue-100 text-blue-700',    icon: <Send size={11} /> },
  3: { label: 'Draft',  color: 'bg-yellow-100 text-yellow-700', icon: <MessageSquare size={11} /> },
  4: { label: 'Outbox', color: 'bg-orange-100 text-orange-700', icon: <Send size={11} /> },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

const SMS_PAGE_SIZE = 20;

export default function SmsPage() {
  const [devices, setDevices]   = useState<Device[]>([]);
  const [selected, setSelected] = useState('');
  const [messages, setMessages] = useState<SmsItem[]>([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [filter, setFilter]     = useState<'all' | 'inbox' | 'sent'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage]         = useState(1);

  useEffect(() => {
    devicesApi.list().then((r) => {
      const devs: Device[] = r.data;
      setDevices(devs);
      const first = devs.find((d) => d.role === 'child');
      if (first) setSelected(first.deviceId);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setPage(1);
    userSmsApi.list(selected, 1000, search || undefined)
      .then((r) => setMessages(r.data))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [selected, search]);

  // Filter by type tab
  const filtered = messages.filter((m) => {
    if (filter === 'inbox') return m.type === 1;
    if (filter === 'sent')  return m.type === 2;
    return true;
  });

  // Paginate filtered list
  const totalPages = Math.max(1, Math.ceil(filtered.length / SMS_PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * SMS_PAGE_SIZE, page * SMS_PAGE_SIZE);

  // Group paginated items by date
  const grouped = paginated.reduce<Record<string, SmsItem[]>>((acc, m) => {
    const key = new Date(m.date).toLocaleDateString('en-IN', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
    (acc[key] ??= []).push(m);
    return acc;
  }, {});

  const inbox  = messages.filter((m) => m.type === 1).length;
  const sent   = messages.filter((m) => m.type === 2).length;
  const unread = messages.filter((m) => !m.isRead && m.type === 1).length;

  // Reset to page 1 when filter changes
  const handleFilter = (f: 'all' | 'inbox' | 'sent') => { setFilter(f); setPage(1); };

  return (
    <>
      <Header title="SMS Messages" subtitle="Text messages from child's device" />

      <main className="flex-1 p-8 space-y-6">
        {/* Controls */}
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

            {/* Filter tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {(['all', 'inbox', 'sent'] as const).map((f) => (
                <button key={f} onClick={() => handleFilter(f)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize
                    ${filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {f === 'all' ? `All (${messages.length})` : f === 'inbox' ? `Inbox (${inbox})` : `Sent (${sent})`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-1 max-w-xs">
              <Search size={14} className="text-gray-400 flex-shrink-0" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                className="input text-sm" placeholder="Search number or message…" />
            </div>

            <div className="ml-auto flex items-center gap-3 text-sm text-gray-500">
              {unread > 0 && (
                <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {unread} unread
                </span>
              )}
              <span className="font-semibold text-gray-700">{filtered.length}</span> messages
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Inbox',  value: inbox,  color: 'bg-green-50 border-green-100 text-green-700' },
            { label: 'Sent',   value: sent,   color: 'bg-blue-50 border-blue-100 text-blue-700' },
            { label: 'Unread', value: unread, color: 'bg-yellow-50 border-yellow-100 text-yellow-700' },
          ].map((s) => (
            <div key={s.label} className={`card border ${s.color} py-4`}>
              <p className="text-2xl font-extrabold">{s.value}</p>
              <p className="text-xs mt-0.5 opacity-70">{s.label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <div className="card text-center py-20">
            <MessageSquare size={56} className="mx-auto mb-4 text-gray-200" />
            <h3 className="text-lg font-bold text-gray-600">No messages</h3>
            <p className="text-gray-400 mt-1">
              {search ? 'No results match your search' : 'SMS messages will appear here once captured'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, dayItems]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{date}</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                <div className="space-y-2">
                  {dayItems.map((m) => {
                    const typeInfo = SMS_TYPES[m.type] ?? { label: 'Other', color: 'bg-gray-100 text-gray-600', icon: null };
                    const isOpen   = expanded === m.id;
                    return (
                      <div key={m.id}
                        onClick={() => setExpanded(isOpen ? null : m.id)}
                        className="card py-3 px-4 cursor-pointer hover:shadow-card-hover transition-shadow">
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5
                            ${m.type === 1 ? 'bg-green-50' : 'bg-blue-50'}`}>
                            <MessageSquare size={15} className={m.type === 1 ? 'text-green-500' : 'text-blue-500'} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900 text-sm">{m.address || 'Unknown'}</span>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1 ${typeInfo.color}`}>
                                {typeInfo.icon}{typeInfo.label}
                              </span>
                              {!m.isRead && m.type === 1 && (
                                <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
                              )}
                            </div>
                            <p className={`text-sm text-gray-600 mt-1 ${isOpen ? 'whitespace-pre-wrap break-words' : 'line-clamp-2'}`}>
                              {m.body || <span className="italic text-gray-400">Empty message</span>}
                            </p>
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{timeAgo(m.date)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="card py-3 px-4 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages} · {filtered.length} messages
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(1)} disabled={page === 1}
                    className="px-2.5 py-1.5 text-xs btn-outline disabled:opacity-40">«</button>
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 text-xs btn-outline disabled:opacity-40">← Prev</button>
                  <span className="text-xs text-gray-400 px-2 font-semibold">{page}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-3 py-1.5 text-xs btn-outline disabled:opacity-40">Next →</button>
                  <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                    className="px-2.5 py-1.5 text-xs btn-outline disabled:opacity-40">»</button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
