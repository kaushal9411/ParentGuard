'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { FolderOpen, Loader, Wifi, WifiOff, RefreshCw, File, Folder } from 'lucide-react';
import Header from '@/components/Header';
import { devicesApi, userCommandsApi } from '@/lib/api';
import type { Device } from '@/types';
import PageLoader from '@/components/PageLoader';

interface Cmd {
  id: string; commandType: string; payload: string;
  status: string; result: string | null;
  issuedAt: string; completedAt: string | null;
}

interface FileEntry { name: string; size: number; isDir: boolean; modified: number; path: string; }

function parseResult(raw: string | null) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function fmtTime(s: string) {
  return new Date(s).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}
function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const STATUS: Record<string, { label: string; color: string; dot: string }> = {
  pending:   { label: 'Waiting…',  color: 'text-yellow-600', dot: 'bg-yellow-400 animate-pulse' },
  delivered: { label: 'Delivered', color: 'text-blue-600',   dot: 'bg-blue-400 animate-pulse' },
  executing: { label: 'Running…',  color: 'text-indigo-600', dot: 'bg-indigo-400 animate-pulse' },
  completed: { label: 'Done',      color: 'text-green-600',  dot: 'bg-green-500' },
  failed:    { label: 'Failed',    color: 'text-red-600',    dot: 'bg-red-500' },
};

function FileCard({ cmd }: { cmd: Cmd }) {
  const result  = parseResult(cmd.result);
  const st      = STATUS[cmd.status] ?? STATUS.pending;
  const entries: FileEntry[] = result?.entries ?? [];
  const isPending = ['pending','delivered','executing'].includes(cmd.status);
  const [search, setSearch] = useState('');

  const filtered = entries.filter((f) =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <FolderOpen size={14} className="text-yellow-500" />
          <span className="text-sm font-semibold">File List</span>
          {entries.length > 0 && (
            <span className="text-xs text-gray-400">({entries.length} items)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${st.dot}`} />
          <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
        </div>
      </div>

      {isPending ? (
        <div className="flex items-center gap-3 px-4 py-6 text-gray-400 text-sm">
          <Loader size={14} className="animate-spin flex-shrink-0" /> Scanning device storage…
        </div>
      ) : entries.length > 0 ? (
        <>
          <div className="px-4 py-2 border-b border-gray-100">
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              className="input text-sm py-1.5" placeholder="Filter files…" />
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
            {filtered.map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-sm">
                {f.isDir
                  ? <Folder size={14} className="text-yellow-400 flex-shrink-0" />
                  : <File   size={14} className="text-gray-400 flex-shrink-0" />}
                <span className="flex-1 truncate text-gray-800">{f.name}</span>
                {!f.isDir && <span className="text-xs text-gray-400 flex-shrink-0">{fmtSize(f.size)}</span>}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-4 text-gray-400 text-sm text-center">No files match</div>
            )}
          </div>
        </>
      ) : (
        <div className="px-4 py-4 text-gray-400 text-sm">{cmd.result ?? 'No result yet'}</div>
      )}

      <div className="px-4 py-2 text-gray-400 text-xs border-t border-gray-100">{fmtTime(cmd.issuedAt)}</div>
    </div>
  );
}

export default function RemoteFilesPage() {
  const [devices, setDevices]  = useState<Device[]>([]);
  const [selected, setSelected] = useState('');
  const [commands, setCommands] = useState<Cmd[]>([]);
  const [busy, setBusy]        = useState(false);
  const [loading, setLoading]  = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    devicesApi.list().then((r) => {
      const devs: Device[] = r.data;
      setDevices(devs);
      const first = devs.find((d) => d.role === 'child');
      if (first) setSelected(first.deviceId);
    });
  }, []);

  const fetchCommands = useCallback(async () => {
    if (!selected) return;
    try {
      const r = await userCommandsApi.list(selected);
      setCommands((r.data as Cmd[]).filter((c) => c.commandType === 'list_files'));
    } catch {}
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetchCommands().finally(() => setLoading(false));
    pollRef.current = setInterval(fetchCommands, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected, fetchCommands]);

  async function send() {
    if (!selected) return;
    setBusy(true);
    try {
      await userCommandsApi.issue(selected, 'list_files');
      await fetchCommands();
    } finally { setBusy(false); }
  }

  const device = devices.find((d) => d.deviceId === selected);

  return (
    <>
      <Header title="File Browsing" subtitle="Browse device storage files" />

      <main className="flex-1 p-8 space-y-6">
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
            <button onClick={fetchCommands} className="ml-auto text-gray-400 hover:text-primary">
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        <button onClick={send} disabled={busy}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 shadow-md">
          {busy ? <Loader size={16} className="animate-spin" /> : <FolderOpen size={16} />}
          📂 Scan Device Storage
        </button>

        {loading ? (
          <PageLoader />
        ) : commands.length === 0 ? (
          <div className="card text-center py-16 text-gray-400">
            <FolderOpen size={40} className="mx-auto mb-3 opacity-30" />
            <p>No file scans yet. Click "Scan Device Storage" to start.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {commands.map((cmd) => <FileCard key={cmd.id} cmd={cmd} />)}
          </div>
        )}
      </main>
    </>
  );
}
