'use client';
import { useEffect, useState } from 'react';
import { Ban, Plus, Trash2, ToggleLeft, ToggleRight, Loader, X, Shield } from 'lucide-react';
import Header from '@/components/Header';
import { devicesApi, userAppBlocksApi } from '@/lib/api';
import type { Device } from '@/types';
import PageLoader from '@/components/PageLoader';

interface AppBlockRule {
  id: string; deviceId: string;
  packageName: string; appName: string;
  isBlocked: boolean; createdAt: string;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

function AddModal({ deviceId, onClose, onCreated }: {
  deviceId: string; onClose: () => void; onCreated: () => void;
}) {
  const [appName, setAppName]     = useState('');
  const [pkgName, setPkgName]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!appName.trim() || !pkgName.trim()) { setError('Both fields required'); return; }
    setSaving(true);
    try {
      await userAppBlocksApi.create({ deviceId, packageName: pkgName.trim(), appName: appName.trim() });
      onCreated();
    } catch { setError('Failed to add rule'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Block an App</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">App Name</label>
            <input value={appName} onChange={(e) => setAppName(e.target.value)}
              className="input w-full" placeholder="e.g. WhatsApp" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Package Name</label>
            <input value={pkgName} onChange={(e) => setPkgName(e.target.value)}
              className="input w-full font-mono text-sm" placeholder="e.g. com.whatsapp" required />
            <p className="text-xs text-gray-400 mt-1">
              Find it in Play Store URL or via "App Info" on the device.
            </p>
          </div>

          {/* Common apps quick-fill */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Quick fill common apps:</p>
            <div className="flex flex-wrap gap-2">
              {[
                { name: 'WhatsApp',       pkg: 'com.whatsapp' },
                { name: 'Instagram',      pkg: 'com.instagram.android' },
                { name: 'YouTube',        pkg: 'com.google.android.youtube' },
                { name: 'TikTok',         pkg: 'com.zhiliaoapp.musically' },
                { name: 'Snapchat',       pkg: 'com.snapchat.android' },
                { name: 'Free Fire',      pkg: 'com.dts.freefireth' },
                { name: 'BGMI',           pkg: 'com.pubg.imobile' },
                { name: 'Facebook',       pkg: 'com.facebook.katana' },
              ].map((a) => (
                <button key={a.pkg} type="button"
                  onClick={() => { setAppName(a.name); setPkgName(a.pkg); }}
                  className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-primary hover:text-white transition-colors">
                  {a.name}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              {saving && <Loader size={14} className="animate-spin" />} Block App
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BlockedAppsPage() {
  const [devices, setDevices]   = useState<Device[]>([]);
  const [selected, setSelected]  = useState('');
  const [rules, setRules]        = useState<AppBlockRule[]>([]);
  const [loading, setLoading]    = useState(false);
  const [showAdd, setShowAdd]    = useState(false);
  const [toggling, setToggling]  = useState<string | null>(null);
  const [deleting, setDeleting]  = useState<string | null>(null);

  useEffect(() => {
    devicesApi.list().then((r) => {
      const devs: Device[] = r.data;
      setDevices(devs);
      const first = devs.find((d) => d.role === 'child');
      if (first) setSelected(first.deviceId);
    });
  }, []);

  function fetchRules() {
    if (!selected) return;
    setLoading(true);
    userAppBlocksApi.list(selected)
      .then((r) => setRules(r.data))
      .catch(() => setRules([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchRules(); }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleRule(r: AppBlockRule) {
    setToggling(r.id);
    try {
      await userAppBlocksApi.update(r.id, !r.isBlocked);
      setRules((prev) => prev.map((x) => x.id === r.id ? { ...x, isBlocked: !r.isBlocked } : x));
    } finally { setToggling(null); }
  }

  async function deleteRule(id: string) {
    if (!confirm('Remove this block rule?')) return;
    setDeleting(id);
    try {
      await userAppBlocksApi.delete(id);
      setRules((prev) => prev.filter((x) => x.id !== id));
    } finally { setDeleting(null); }
  }

  const blockedCount = rules.filter((r) => r.isBlocked).length;

  return (
    <>
      <Header title="Blocked Apps" subtitle="Manage which apps are blocked on child's device" />

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
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm text-gray-500">
                <span className="font-semibold text-gray-800">{blockedCount}</span> blocked / {rules.length} total
              </span>
              <button onClick={() => setShowAdd(true)}
                className="btn-primary flex items-center gap-2">
                <Plus size={15} /> Block App
              </button>
            </div>
          </div>
        </div>

        {/* Info banner */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700 flex items-start gap-2">
          <Shield size={13} className="flex-shrink-0 mt-0.5 text-amber-500" />
          Blocked apps are enforced by the Accessibility Service on the child device.
          The app will be immediately closed if the child attempts to open it.
          Make sure Accessibility Service is enabled in device settings.
        </div>

        {loading ? (
          <PageLoader />
        ) : rules.length === 0 ? (
          <div className="card text-center py-20">
            <Ban size={56} className="mx-auto mb-4 text-gray-200" />
            <h3 className="text-lg font-bold text-gray-600">No apps blocked</h3>
            <p className="text-gray-400 mt-1 mb-6">Add apps to block them on the child device</p>
            <button onClick={() => setShowAdd(true)} className="btn-primary mx-auto flex items-center gap-2">
              <Plus size={15} /> Block Your First App
            </button>
          </div>
        ) : (
          <div className="card divide-y divide-gray-100 p-0 overflow-hidden">
            {rules.map((r) => (
              <div key={r.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                {/* App icon initial */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-white text-sm
                  ${r.isBlocked ? 'bg-red-500' : 'bg-gray-400'}`}>
                  {r.appName.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{r.appName}</p>
                  <p className="text-xs text-gray-400 font-mono truncate">{r.packageName}</p>
                  <p className="text-xs text-gray-300 mt-0.5">Added {fmtDate(r.createdAt)}</p>
                </div>

                {/* Status badge */}
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0
                  ${r.isBlocked ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                  {r.isBlocked ? 'Blocked' : 'Allowed'}
                </span>

                {/* Toggle + delete */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => toggleRule(r)} disabled={toggling === r.id}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors">
                    {toggling === r.id
                      ? <Loader size={16} className="animate-spin" />
                      : r.isBlocked
                        ? <ToggleRight size={20} className="text-red-500" />
                        : <ToggleLeft size={20} />}
                  </button>
                  <button onClick={() => deleteRule(r.id)} disabled={deleting === r.id}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                    {deleting === r.id
                      ? <Loader size={14} className="animate-spin" />
                      : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showAdd && (
        <AddModal deviceId={selected} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); fetchRules(); }} />
      )}
    </>
  );
}
