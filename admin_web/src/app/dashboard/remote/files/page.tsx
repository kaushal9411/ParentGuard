'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  FolderOpen, Folder, File as FileIcon, Loader,
  Wifi, WifiOff, RefreshCw, ChevronRight, Home,
  Download, Archive, CheckCircle, AlertCircle,
} from 'lucide-react';
import Header from '@/components/Header';
import { devicesApi, userCommandsApi } from '@/lib/api';
import PageLoader from '@/components/PageLoader';
import type { Device } from '@/types';

interface Cmd { id: string; commandType: string; payload: string; status: string; result: string | null; issuedAt: string; }
interface FileEntry { name: string; size: number; isDir: boolean; modified: number; path: string; }
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

function saveFile(b64: string, mimeType: string, fileName: string) {
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function RemoteFilesPage() {
  const [devices, setDevices]   = useState<Device[]>([]);
  const [selected, setSelected] = useState('');
  const [allCmds, setAllCmds]   = useState<Cmd[]>([]);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const [filter, setFilter]     = useState('');
  const [dlMap, setDlMap]       = useState<Record<string, DlState>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    devicesApi.list().then((r) => {
      const devs: Device[] = r.data;
      setDevices(devs);
      const first = devs.find((d) => d.role === 'child');
      if (first) setSelected(first.deviceId);
    });
  }, []);

  const fetchCmds = useCallback(async () => {
    if (!selected) return;
    try {
      const r = await userCommandsApi.list(selected, 100);
      const cmds: Cmd[] = (r.data as Cmd[]).filter((c) =>
        ['list_files','download_file','download_folder'].includes(c.commandType));
      setAllCmds(cmds);

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
            } catch { next[path] = { ...dl, status: 'error', errorMsg: 'Parse failed' }; }
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
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetchCmds().finally(() => setLoading(false));
    pollRef.current = setInterval(fetchCmds, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected, fetchCmds]);

  async function listPath(path: string) {
    if (!selected) return;
    setScanning(true); setCurrentPath(path); setFilter('');
    try {
      await userCommandsApi.issue(selected, 'list_files', path ? { path } : {});
      await fetchCmds();
    } finally { setScanning(false); }
  }

  async function requestDownload(path: string, isDir: boolean) {
    if (!selected || dlMap[path]?.status === 'pending') return;
    try {
      const res = await userCommandsApi.issue(selected, isDir ? 'download_folder' : 'download_file', { path });
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
  const device      = devices.find((d) => d.deviceId === selected);

  return (
    <>
      <Header title="File Browsing" subtitle="Browse and download files from child's device" />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-4">
        <div className="card py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700">Device:</label>
              <select value={selected}
                onChange={(e) => { setSelected(e.target.value); setCurrentPath(''); setDlMap({}); }}
                className="input max-w-xs">
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
            <button onClick={fetchCmds} className="ml-auto text-gray-400 hover:text-primary">
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        <button onClick={() => listPath('')} disabled={scanning || !selected}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 shadow-md">
          {scanning ? <Loader size={16} className="animate-spin" /> : <FolderOpen size={16} />}
          📂 Scan Root Storage
        </button>

        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
          Click <strong>📁 folder</strong> to browse inside ·
          <Download size={11} className="inline mx-1" /> to request a file download ·
          <Archive size={11} className="inline mx-1" /> to download a folder as ZIP ·
          When ready, click the green <strong>Save</strong> button. Max 15 MB / file, 30 MB / folder.
        </div>

        {loading ? <PageLoader /> : (
          <>
            {pendingListCmd && (
              <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-yellow-700 text-sm">
                <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                Scanning… (~10 s)
              </div>
            )}

            {found ? (
              <div className="card overflow-hidden p-0">
                {/* Breadcrumb */}
                <div className="flex items-center gap-1 px-4 py-3 border-b border-gray-100 overflow-x-auto bg-gray-50">
                  <button onClick={() => listPath('')}
                    className="text-gray-500 hover:text-yellow-600 transition-colors flex-shrink-0">
                    <Home size={13} />
                  </button>
                  {crumbs.map((c, i) => (
                    <div key={c.path} className="flex items-center gap-1 flex-shrink-0">
                      <ChevronRight size={12} className="text-gray-300" />
                      <button onClick={() => listPath(c.path)}
                        className={`text-xs font-medium transition-colors truncate max-w-[120px]
                          ${i === crumbs.length - 1 ? 'text-gray-900 cursor-default' : 'text-gray-500 hover:text-yellow-600'}`}>
                        {c.label}
                      </button>
                    </div>
                  ))}
                  <span className="ml-auto text-gray-400 text-xs flex-shrink-0 pl-4">
                    {entries.length} items · {fmtTime(found.cmd.issuedAt)}
                  </span>
                </div>

                {/* Filter */}
                <div className="px-4 py-2 border-b border-gray-100">
                  <input value={filter} onChange={(e) => setFilter(e.target.value)}
                    className="input text-sm py-1.5" placeholder="Filter…" />
                </div>

                {filtered.length === 0 ? (
                  <div className="px-4 py-8 text-gray-400 text-sm text-center">
                    {filter ? 'No items match' : 'Empty folder'}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                    {filtered.map((f, i) => {
                      const dl = dlMap[f.path];
                      return (
                        <div key={i} className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50/80 transition-colors">
                          <div className={`flex items-center gap-2 flex-1 min-w-0 ${f.isDir ? 'cursor-pointer' : ''}`}
                            onClick={() => f.isDir && listPath(f.path)}>
                            {f.isDir
                              ? <Folder size={15} className="text-yellow-500 flex-shrink-0" />
                              : <FileIcon size={15} className="text-gray-400 flex-shrink-0" />}
                            <span className={`truncate text-sm ${f.isDir ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
                              {f.name}
                            </span>
                            {f.isDir && <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />}
                          </div>

                          {!f.isDir && <span className="text-xs text-gray-400 flex-shrink-0">{fmtSize(f.size)}</span>}

                          {/* Download control */}
                          {!dl || dl.status === 'pending' ? (
                            <button
                              onClick={() => requestDownload(f.path, f.isDir)}
                              disabled={dl?.status === 'pending'}
                              title={f.isDir ? 'Download as ZIP' : 'Download'}
                              className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors disabled:opacity-40
                                ${f.isDir ? 'text-indigo-500 hover:bg-indigo-50' : 'text-yellow-600 hover:bg-yellow-50'}`}>
                              {dl?.status === 'pending'
                                ? <Loader size={12} className="animate-spin" />
                                : f.isDir ? <Archive size={12} /> : <Download size={12} />}
                            </button>
                          ) : dl.status === 'ready' ? (
                            <button
                              onClick={() => saveFile(dl.b64!, dl.mimeType!, dl.name!)}
                              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-green-100 text-green-700 hover:bg-green-200 transition-colors font-semibold">
                              <CheckCircle size={12} /> Save
                            </button>
                          ) : (
                            <span title={dl.errorMsg}
                              className="flex-shrink-0 flex items-center gap-1 text-xs text-red-500 cursor-help">
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
              <div className="card text-center py-16 text-gray-400">
                <FolderOpen size={40} className="mx-auto mb-3 opacity-30" />
                <p>Click "Scan Root Storage" to start browsing.</p>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
