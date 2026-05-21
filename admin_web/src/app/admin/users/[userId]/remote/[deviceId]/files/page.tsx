'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, FolderOpen, Folder, File as FileIcon,
  Loader, RefreshCw, Wifi, WifiOff, ChevronRight, Home,
  Download, Archive, CheckCircle, AlertCircle,
} from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import PageLoader from '@/components/PageLoader';

interface Cmd { id: string; commandType: string; payload: string; status: string; result: string | null; issuedAt: string; }
interface DeviceInfo { deviceId: string; name: string; isOnline: boolean; }
interface FileEntry { name: string; size: number; isDir: boolean; modified: number; path: string; parentPath: string; }
interface FileResult { type: string; path: string; entries: FileEntry[]; }
interface DlState { cmdId: string; status: 'pending' | 'ready' | 'error'; b64?: string; mimeType?: string; name?: string; errorMsg?: string; }

function parseListResult(raw: string | null): FileResult | null {
  if (!raw) return null;
  try { const r = JSON.parse(raw); return r?.type === 'files' ? r : null; } catch { return null; }
}
function fmtTime(s: string) { return new Date(s).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }); }
function fmtSize(n: number) {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}
function buildBreadcrumbs(path: string) {
  const crumbs: { label: string; path: string }[] = [];
  let cur = '';
  for (const p of path.replace(/\\/g, '/').split('/').filter(Boolean)) {
    cur += '/' + p;
    crumbs.push({ label: p, path: cur });
  }
  return crumbs;
}

// Blob + object URL approach — works for large files and avoids data: URL limits
function saveFile(b64: string, mimeType: string, fileName: string) {
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function AdminRemoteFilesPage() {
  const { userId, deviceId } = useParams<{ userId: string; deviceId: string }>();
  const router = useRouter();

  const [device, setDevice]     = useState<DeviceInfo | null>(null);
  const [allCmds, setAllCmds]   = useState<Cmd[]>([]);
  const [loading, setLoading]   = useState(true);
  const [scanning, setScanning] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const [filter, setFilter]     = useState('');

  // path → download state
  const [dlMap, setDlMap] = useState<Record<string, DlState>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    adminApi.userDetail(userId)
      .then((r) => setDevice(r.data.devices?.find((d: DeviceInfo) => d.deviceId === deviceId) ?? null))
      .catch(() => {});
  }, [userId, deviceId]);

  const fetchCmds = useCallback(async () => {
    try {
      const r = await adminApi.deviceCommands(deviceId);
      const cmds: Cmd[] = r.data ?? [];
      setAllCmds(cmds);

      // Update dlMap for pending download commands that now have a result
      setDlMap((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const [path, dl] of Object.entries(next)) {
          if (dl.status !== 'pending') continue;
          const cmd = cmds.find((c) => c.id === dl.cmdId);
          if (!cmd) continue;
          if (cmd.status === 'completed' && cmd.result) {
            try {
              const res = JSON.parse(cmd.result);
              if (res?.type === 'file' && res.data) {
                next[path] = { ...dl, status: 'ready', b64: res.data, mimeType: res.mimeType, name: res.name };
              } else {
                next[path] = { ...dl, status: 'error', errorMsg: res?.message ?? 'Unknown error' };
              }
            } catch {
              next[path] = { ...dl, status: 'error', errorMsg: 'Failed to parse result' };
            }
            changed = true;
          } else if (cmd.status === 'failed') {
            const msg = cmd.result ? (() => { try { return JSON.parse(cmd.result)?.message; } catch { return null; } })() : null;
            next[path] = { ...dl, status: 'error', errorMsg: msg ?? 'Command failed' };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    } catch {}
  }, [deviceId]);

  useEffect(() => {
    setLoading(true);
    fetchCmds().finally(() => setLoading(false));
    pollRef.current = setInterval(fetchCmds, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchCmds]);

  async function listPath(path: string) {
    setScanning(true); setCurrentPath(path); setFilter('');
    try {
      await adminApi.issueCommand(deviceId, 'list_files', path ? { path } : {});
      await fetchCmds();
    } finally { setScanning(false); }
  }

  async function requestDownload(path: string, isDir: boolean) {
    if (dlMap[path]?.status === 'pending') return;
    try {
      const res = await adminApi.issueCommand(deviceId, isDir ? 'download_folder' : 'download_file', { path });
      setDlMap((prev) => ({ ...prev, [path]: { cmdId: res.data.id, status: 'pending' } }));
    } catch {}
  }

  const listCmds       = allCmds.filter((c) => c.commandType === 'list_files');
  const pendingListCmd = listCmds.find((c) => ['pending','delivered','executing'].includes(c.status));

  function findResultForPath(path: string) {
    const done = listCmds.filter((c) => c.status === 'completed' && c.result);
    if (!done.length) return null;
    for (const cmd of done) {
      const r = parseListResult(cmd.result);
      if (r && (r.path === path || (!path && r.path))) return { cmd, result: r };
    }
    const r = parseListResult(done[0].result);
    return r ? { cmd: done[0], result: r } : null;
  }

  const found       = findResultForPath(currentPath);
  const entries     = found?.result.entries ?? [];
  const displayPath = found?.result.path ?? currentPath;
  const crumbs      = displayPath ? buildBreadcrumbs(displayPath) : [];
  const filtered    = entries.filter((f) => !filter || f.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-8 pt-8 pb-5 border-b border-gray-800">
        <button onClick={() => router.push(`/admin/users/${userId}/remote/${deviceId}`)}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors">
          <ArrowLeft size={15} /> Remote Access
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
              <FolderOpen size={20} className="text-yellow-400" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white">File Browsing</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-gray-400 text-sm">{device?.name ?? deviceId}</span>
                {device?.isOnline
                  ? <span className="flex items-center gap-1 text-green-400 text-xs"><Wifi size={11} /> Live</span>
                  : <span className="flex items-center gap-1 text-gray-500 text-xs"><WifiOff size={11} /> Offline</span>}
              </div>
            </div>
          </div>
          <button onClick={fetchCmds} className="text-gray-600 hover:text-gray-300"><RefreshCw size={15} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-4">
        <button onClick={() => listPath('')} disabled={scanning}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-yellow-600 hover:bg-yellow-700 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 shadow-lg">
          {scanning ? <Loader size={16} className="animate-spin" /> : <FolderOpen size={16} />}
          📂 Scan Root Storage
        </button>

        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-xs text-gray-500">
          Click <strong className="text-gray-400">📁 folder</strong> to browse ·
          <Download size={11} className="inline mx-1 text-yellow-400" /> download a file ·
          <Archive size={11} className="inline mx-1 text-indigo-400" /> download folder as ZIP (max 15 MB / file, 30 MB / folder)
        </div>

        {loading ? <PageLoader theme="dark" /> : (
          <>
            {pendingListCmd && (
              <div className="flex items-center gap-3 bg-blue-900/20 border border-blue-800/40 rounded-xl px-4 py-3 text-blue-300 text-sm">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                Scanning… (~10 s)
              </div>
            )}

            {found ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                {/* Breadcrumb */}
                <div className="flex items-center gap-1 px-4 py-3 border-b border-gray-800 overflow-x-auto">
                  <button onClick={() => listPath('')}
                    className="text-gray-400 hover:text-yellow-400 transition-colors flex-shrink-0">
                    <Home size={13} />
                  </button>
                  {crumbs.map((c, i) => (
                    <div key={c.path} className="flex items-center gap-1 flex-shrink-0">
                      <ChevronRight size={12} className="text-gray-700" />
                      <button onClick={() => listPath(c.path)}
                        className={`text-xs font-medium transition-colors truncate max-w-[120px]
                          ${i === crumbs.length - 1 ? 'text-white cursor-default' : 'text-gray-400 hover:text-yellow-400'}`}>
                        {c.label}
                      </button>
                    </div>
                  ))}
                  <span className="ml-auto text-gray-600 text-xs flex-shrink-0 pl-4">
                    {entries.length} items · {fmtTime(found.cmd.issuedAt)}
                  </span>
                </div>

                {/* Filter */}
                <div className="px-4 py-2 border-b border-gray-800">
                  <input value={filter} onChange={(e) => setFilter(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 placeholder-gray-600"
                    placeholder="Filter…" />
                </div>

                {filtered.length === 0 ? (
                  <div className="px-4 py-8 text-gray-600 text-sm text-center">
                    {filter ? 'No items match' : 'Empty folder'}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-800/50 max-h-[600px] overflow-y-auto">
                    {filtered.map((f, i) => {
                      const dl = dlMap[f.path];
                      return (
                        <div key={i} className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-800/40 transition-colors">
                          {/* Navigate folders */}
                          <div className={`flex items-center gap-2 flex-1 min-w-0 ${f.isDir ? 'cursor-pointer' : ''}`}
                            onClick={() => f.isDir && listPath(f.path)}>
                            {f.isDir
                              ? <Folder size={15} className="text-yellow-400 flex-shrink-0" />
                              : <FileIcon size={15} className="text-gray-500 flex-shrink-0" />}
                            <span className={`truncate text-sm ${f.isDir ? 'text-gray-200 font-medium' : 'text-gray-400'}`}>
                              {f.name}
                            </span>
                            {f.isDir && <ChevronRight size={12} className="text-gray-700 flex-shrink-0" />}
                          </div>

                          {!f.isDir && <span className="text-xs text-gray-600 flex-shrink-0">{fmtSize(f.size)}</span>}

                          {/* Download control */}
                          {!dl || dl.status === 'pending' ? (
                            <button
                              onClick={() => requestDownload(f.path, f.isDir)}
                              disabled={dl?.status === 'pending'}
                              title={f.isDir ? 'Download as ZIP' : 'Download'}
                              className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors disabled:opacity-40
                                ${f.isDir ? 'text-indigo-400 hover:bg-indigo-900/30' : 'text-yellow-400 hover:bg-yellow-900/20'}`}>
                              {dl?.status === 'pending'
                                ? <Loader size={12} className="animate-spin" />
                                : f.isDir ? <Archive size={12} /> : <Download size={12} />}
                            </button>
                          ) : dl.status === 'ready' ? (
                            <button
                              onClick={() => saveFile(dl.b64!, dl.mimeType!, dl.name!)}
                              className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-green-900/30 text-green-400 hover:bg-green-900/50 transition-colors font-semibold">
                              <CheckCircle size={12} /> Save
                            </button>
                          ) : (
                            <span title={dl.errorMsg} className="flex-shrink-0 flex items-center gap-1 text-xs text-red-500">
                              <AlertCircle size={12} /> Error
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : !pendingListCmd && (
              <div className="text-center py-16 text-gray-600">
                <FolderOpen size={40} className="mx-auto mb-3 opacity-20" />
                <p>Click "Scan Root Storage" to start browsing.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
