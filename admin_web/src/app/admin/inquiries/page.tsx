'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  MessageSquare, Mail, Phone, Clock, Search, Trash2,
  CheckCircle, Eye, Reply, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import PageLoader from '@/components/PageLoader';
import { confirmDialog } from '@/lib/confirm';
import { toast } from 'sonner';

interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: string;
  notes: string | null;
  createdAt: string;
}

const STATUS_OPTS = [
  { value: 'all',     label: 'All' },
  { value: 'new',     label: 'New' },
  { value: 'read',    label: 'Read' },
  { value: 'replied', label: 'Replied' },
];

function statusBadge(status: string) {
  if (status === 'new')     return <span className="text-yellow-400 bg-yellow-900/30 text-xs px-2 py-0.5 rounded-full font-semibold">New</span>;
  if (status === 'read')    return <span className="text-blue-400 bg-blue-900/30 text-xs px-2 py-0.5 rounded-full font-semibold">Read</span>;
  if (status === 'replied') return <span className="text-green-400 bg-green-900/30 text-xs px-2 py-0.5 rounded-full font-semibold">Replied</span>;
  return <span className="text-gray-400 bg-gray-800 text-xs px-2 py-0.5 rounded-full font-semibold capitalize">{status}</span>;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Notes modal ───────────────────────────────────────────────────────────────
function NotesModal({ inquiry, onClose, onSave }: {
  inquiry: Inquiry; onClose: () => void; onSave: (notes: string, status: string) => void;
}) {
  const [notes,  setNotes]  = useState(inquiry.notes ?? '');
  const [status, setStatus] = useState(inquiry.status);
  const [saving, setSaving] = useState(false);

  const inp = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500';

  async function save() {
    setSaving(true);
    try {
      await adminApi.updateInquiry(inquiry.id, { notes, status });
      onSave(notes, status);
      toast.success('Inquiry updated');
    } catch {
      toast.error('Failed to update');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-white font-bold">Inquiry from {inquiry.name}</h2>
            <p className="text-gray-500 text-xs mt-0.5">{inquiry.email}{inquiry.phone ? ` · ${inquiry.phone}` : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Original message (read-only) */}
          <div>
            <label className="text-gray-400 text-xs font-semibold mb-1 block uppercase tracking-wide">Message</label>
            <div className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
              {inquiry.message}
            </div>
          </div>
          {/* Status */}
          <div>
            <label className="text-gray-400 text-xs font-semibold mb-1 block uppercase tracking-wide">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inp}>
              <option value="new">New</option>
              <option value="read">Read</option>
              <option value="replied">Replied</option>
            </select>
          </div>
          {/* Admin notes */}
          <div>
            <label className="text-gray-400 text-xs font-semibold mb-1 block uppercase tracking-wide">Admin Notes</label>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Add internal notes, follow-up reminders…"
              className={`${inp} resize-none`} />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-gray-800">
          <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function InquiriesPage() {
  const [inquiries, setInquiries]   = useState<Inquiry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilter]   = useState('all');
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [editing, setEditing]       = useState<Inquiry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.getInquiries();
      setInquiries(r.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markRead(inq: Inquiry) {
    if (inq.status !== 'new') return;
    await adminApi.updateInquiry(inq.id, { status: 'read' });
    setInquiries((prev) => prev.map((i) => i.id === inq.id ? { ...i, status: 'read' } : i));
  }

  async function deleteInquiry(id: string, name: string) {
    const ok = await confirmDialog({
      title: `Delete inquiry from "${name}"?`,
      text: 'This cannot be undone.',
      confirmText: 'Delete',
      type: 'danger', theme: 'dark',
    });
    if (!ok) return;
    await adminApi.deleteInquiry(id);
    setInquiries((prev) => prev.filter((i) => i.id !== id));
    toast.success('Inquiry deleted');
  }

  function handleSave(id: string, notes: string, status: string) {
    setInquiries((prev) => prev.map((i) => i.id === id ? { ...i, notes, status } : i));
    setEditing(null);
  }

  const filtered = inquiries.filter((i) => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return i.name.toLowerCase().includes(q) || i.email.toLowerCase().includes(q) || i.message.toLowerCase().includes(q);
  });

  const newCount     = inquiries.filter((i) => i.status === 'new').length;
  const readCount    = inquiries.filter((i) => i.status === 'read').length;
  const repliedCount = inquiries.filter((i) => i.status === 'replied').length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-800">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
              <MessageSquare size={24} className="text-indigo-400" /> Inquiries
              {newCount > 0 && (
                <span className="bg-yellow-500 text-black text-xs font-extrabold px-2 py-0.5 rounded-full">{newCount} new</span>
              )}
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">Contact form submissions from the landing page</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total',    value: inquiries.length, color: 'text-white' },
            { label: 'New',      value: newCount,         color: 'text-yellow-400' },
            { label: 'Read',     value: readCount,        color: 'text-blue-400' },
            { label: 'Replied',  value: repliedCount,     color: 'text-green-400' },
          ].map((s) => (
            <div key={s.label} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
              <p className="text-gray-500 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status filter tabs */}
          <div className="flex gap-1 bg-gray-800 rounded-xl p-1">
            {STATUS_OPTS.map((o) => (
              <button key={o.value} onClick={() => setFilter(o.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors
                  ${filterStatus === o.value ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {o.label}
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, message…"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
          </div>
          <span className="text-gray-500 text-sm ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {loading ? <PageLoader theme="dark" /> : filtered.length === 0 ? (
          <div className="text-center py-20">
            <MessageSquare size={48} className="mx-auto mb-3 text-gray-700" />
            <p className="text-gray-400 font-medium">
              {search || filterStatus !== 'all' ? 'No inquiries match your filters' : 'No inquiries yet — they\'ll appear here when visitors send a message'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((inq) => {
              const isOpen = expanded === inq.id;
              return (
                <div key={inq.id}
                  className={`bg-gray-900 border rounded-2xl overflow-hidden transition-all
                    ${inq.status === 'new' ? 'border-yellow-800/50 shadow-yellow-900/20 shadow-md' : 'border-gray-800'}`}>
                  {/* Summary row */}
                  <div className="flex items-center gap-4 px-5 py-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 bg-indigo-700/40 rounded-xl flex items-center justify-center text-indigo-300 font-bold text-sm flex-shrink-0">
                      {inq.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-semibold text-sm">{inq.name}</span>
                        {statusBadge(inq.status)}
                        {inq.notes && (
                          <span className="text-indigo-400 text-[10px] bg-indigo-900/30 px-1.5 py-0.5 rounded-full">Has notes</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Mail size={10} /> {inq.email}</span>
                        {inq.phone && <span className="flex items-center gap-1"><Phone size={10} /> {inq.phone}</span>}
                        <span className="flex items-center gap-1"><Clock size={10} /> {timeAgo(inq.createdAt)}</span>
                      </div>
                      {!isOpen && (
                        <p className="text-gray-400 text-xs mt-1 truncate">{inq.message}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {inq.status === 'new' && (
                        <button onClick={() => markRead(inq)}
                          title="Mark as read"
                          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-900/20 hover:bg-blue-900/40 px-2.5 py-1.5 rounded-lg transition-colors">
                          <Eye size={11} /> Read
                        </button>
                      )}
                      <button onClick={() => { setEditing(inq); if (inq.status === 'new') markRead(inq); }}
                        title="Add notes / change status"
                        className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-900/20 hover:bg-indigo-900/40 px-2.5 py-1.5 rounded-lg transition-colors">
                        <Reply size={11} /> Manage
                      </button>
                      <button onClick={() => deleteInquiry(inq.id, inq.name)}
                        className="text-xs text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/40 p-1.5 rounded-lg transition-colors">
                        <Trash2 size={13} />
                      </button>
                      <button onClick={() => { setExpanded(isOpen ? null : inq.id); if (inq.status === 'new') markRead(inq); }}
                        className="text-gray-500 hover:text-white p-1.5 rounded-lg transition-colors">
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded message */}
                  {isOpen && (
                    <div className="border-t border-gray-800 px-5 py-4 space-y-3">
                      <div>
                        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1.5">Message</p>
                        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{inq.message}</p>
                      </div>
                      {inq.notes && (
                        <div>
                          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1.5">Admin Notes</p>
                          <p className="text-indigo-300 text-sm leading-relaxed whitespace-pre-wrap">{inq.notes}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <a href={`mailto:${inq.email}`}
                          className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 bg-green-900/20 hover:bg-green-900/40 px-3 py-1.5 rounded-lg transition-colors">
                          <Mail size={11} /> Reply via Email
                        </a>
                        {inq.phone && (
                          <a href={`tel:${inq.phone}`}
                            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-900/20 hover:bg-blue-900/40 px-3 py-1.5 rounded-lg transition-colors">
                            <Phone size={11} /> Call
                          </a>
                        )}
                        <button
                          onClick={async () => {
                            await adminApi.updateInquiry(inq.id, { status: 'replied' });
                            setInquiries((prev) => prev.map((i) => i.id === inq.id ? { ...i, status: 'replied' } : i));
                            toast.success('Marked as replied');
                          }}
                          className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-900/20 hover:bg-indigo-900/40 px-3 py-1.5 rounded-lg transition-colors">
                          <CheckCircle size={11} /> Mark Replied
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editing && (
        <NotesModal
          inquiry={editing}
          onClose={() => setEditing(null)}
          onSave={(notes, status) => handleSave(editing.id, notes, status)}
        />
      )}
    </div>
  );
}
