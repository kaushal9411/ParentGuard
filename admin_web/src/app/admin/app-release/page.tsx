'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Download, Upload, Smartphone, CheckCircle,
  AlertCircle, Package, Clock, Info,
} from 'lucide-react';
// adminAxios used indirectly via fetch with token from localStorage

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

interface AppInfo {
  version: string; buildType: string; notes: string;
  uploadedAt: string; sizeMb: string | null; available: boolean;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AppReleasePage() {
  const [info, setInfo]           = useState<AppInfo | null>(null);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const fileRef                   = useRef<HTMLInputElement>(null);

  // Upload form state
  const [version,   setVersion]   = useState('1.0.0');
  const [buildType, setBuildType] = useState('release');
  const [notes,     setNotes]     = useState('');
  const [file,      setFile]      = useState<File | null>(null);

  async function loadInfo() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/downloads/app-info`);
      setInfo(await res.json());
    } finally { setLoading(false); }
  }

  useEffect(() => { loadInfo(); }, []);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  }

  async function uploadApk() {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      const params = new URLSearchParams({ version, buildType, notes });
      const res = await fetch(`${API}/api/downloads/admin/upload?${params}`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/octet-stream',
          'Authorization': `Bearer ${localStorage.getItem('pm_admin_token') ?? ''}`,
        },
        body: file,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error);
      }

      const data = await res.json();
      showToast(`✓ APK v${data.version} uploaded (${data.sizeMb} MB)`, true);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      loadInfo();
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Upload failed', false);
    } finally { setUploading(false); setProgress(0); }
  }

  const inp = 'w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-800">
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
          <Package size={24} className="text-indigo-400" /> App Release Management
        </h1>
        <p className="text-gray-500 text-sm mt-1">Upload the APK build so users can download it from their portal</p>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-white text-sm font-semibold ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="flex-1 p-8 space-y-6 overflow-y-auto">

        {/* Current Release Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <Smartphone size={18} className="text-indigo-400" /> Current Release
          </h2>
          {loading ? (
            <div className="flex items-center gap-3 text-gray-500">
              <div className="w-5 h-5 border-2 border-gray-600 border-t-indigo-400 rounded-full animate-spin" />
              Loading…
            </div>
          ) : info?.available ? (
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-extrabold text-white">v{info.version}</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${info.buildType === 'release' ? 'bg-green-900/40 text-green-400 border border-green-800' : 'bg-yellow-900/40 text-yellow-400 border border-yellow-800'}`}>
                    {info.buildType}
                  </span>
                  <CheckCircle size={16} className="text-green-400" />
                </div>
                {info.notes && <p className="text-gray-400 text-sm">{info.notes}</p>}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5"><Package size={13} /> {info.sizeMb} MB</span>
                  <span className="flex items-center gap-1.5"><Clock size={13} /> Uploaded {fmtDate(info.uploadedAt)}</span>
                </div>
              </div>
              <a
                href={`${API}/api/downloads/app?token=${localStorage.getItem('pm_admin_token') ?? ''}`}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
                download
              >
                <Download size={15} /> Download Current APK
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-yellow-400 bg-yellow-900/20 border border-yellow-800/40 rounded-xl px-4 py-3">
              <AlertCircle size={16} />
              <p className="text-sm">No APK uploaded yet. Upload one below so users can download the app.</p>
            </div>
          )}
        </div>

        {/* Upload New APK */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-white font-bold text-lg mb-5 flex items-center gap-2">
            <Upload size={18} className="text-indigo-400" /> Upload New Build
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Version</label>
              <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.0" className={inp} />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Build Type</label>
              <select value={buildType} onChange={(e) => setBuildType(e.target.value)} className={inp}>
                <option value="release">Release</option>
                <option value="debug">Debug</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Release Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Bug fixes and improvements" className={inp} />
            </div>
          </div>

          {/* File picker */}
          <div
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${file ? 'border-indigo-500 bg-indigo-900/10' : 'border-gray-700 hover:border-gray-500'}`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".apk"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="space-y-1">
                <Package size={32} className="text-indigo-400 mx-auto" />
                <p className="text-white font-semibold">{file.name}</p>
                <p className="text-gray-500 text-sm">{(file.size / 1_048_576).toFixed(1)} MB · Click to change</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload size={32} className="text-gray-600 mx-auto" />
                <p className="text-gray-400 font-medium">Click to select APK file</p>
                <p className="text-gray-600 text-sm">Build your APK: <code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">flutter build apk --release</code></p>
                <p className="text-gray-600 text-xs">Then find it at: <code className="bg-gray-800 px-1.5 py-0.5 rounded">build/app/outputs/flutter-apk/app-release.apk</code></p>
              </div>
            )}
          </div>

          {uploading && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-400 mb-1">
                <span>Uploading…</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full animate-pulse w-full" />
              </div>
            </div>
          )}

          <button
            onClick={uploadApk}
            disabled={!file || uploading}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-sm py-3 rounded-xl transition-colors"
          >
            {uploading
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading…</>
              : <><Upload size={15} /> Upload &amp; Publish APK</>}
          </button>
        </div>

        {/* Build instructions */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <Info size={18} className="text-indigo-400" /> How to Build a Release APK
          </h2>
          <ol className="space-y-3 text-sm text-gray-400">
            {[
              ['Open terminal in the mobile_app folder',
               'cd c:/xampp/htdocs/parental_monitor/mobile_app'],
              ['Build with your server IP',
               'flutter build apk --release --dart-define=BACKEND_URL=http://YOUR_SERVER_IP:3000'],
              ['Find the APK',
               'build/app/outputs/flutter-apk/app-release.apk'],
              ['Upload it here', 'Use the uploader above → users can download instantly'],
            ].map(([title, code], i) => (
              <li key={i} className="flex gap-3">
                <span className="w-6 h-6 bg-indigo-700/40 rounded-full flex items-center justify-center text-indigo-400 font-bold text-xs flex-shrink-0 mt-0.5">{i + 1}</span>
                <div>
                  <p className="text-white font-medium">{title}</p>
                  <code className="text-indigo-300 text-xs bg-gray-800 px-2 py-1 rounded block mt-1">{code}</code>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
