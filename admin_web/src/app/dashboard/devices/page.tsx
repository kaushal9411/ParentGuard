'use client';
import { useEffect, useState } from 'react';
import { Smartphone, Plus, Wifi, WifiOff, Copy, Check, X, Clock, Trash2 } from 'lucide-react';
import Header from '@/components/Header';
import { devicesApi } from '@/lib/api';
import type { Device } from '@/types';
import PageLoader from '@/components/PageLoader';
import { confirmDialog, stepConfirm } from '@/lib/confirm';
import { toast } from 'sonner';
import { usePlan } from '@/context/PlanContext';
import Link from 'next/link';

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function AddDeviceModal({ onClose, onAdded }: { onClose: () => void; onAdded: (d: Device) => void }) {
  const [form, setForm] = useState({ deviceName: '', deviceId: '', role: 'child' as 'child' | 'parent' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<Device | null>(null);
  const [copied, setCopied] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.deviceName.trim() || !form.deviceId.trim()) { setError('All fields required'); return; }
    setError(''); setLoading(true);
    try {
      const res = await devicesApi.create({ deviceId: form.deviceId.trim(), deviceName: form.deviceName.trim(), deviceRole: form.role });
      setCreated(res.data as Device);
      onAdded(res.data as Device);
      toast.success(`Device "${form.deviceName}" added successfully`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Failed to add device');
    } finally { setLoading(false); }
  }

  function copyId() {
    if (created) { navigator.clipboard.writeText(created.deviceId); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="font-bold text-lg text-gray-900">Add Child Device</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        {created ? (
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={28} className="text-green-600" />
              </div>
              <h4 className="font-bold text-gray-900 text-lg">Device Added!</h4>
              <p className="text-gray-500 text-sm mt-1">Share the Device ID with the child&apos;s phone to link it.</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <p className="text-xs text-gray-500 mb-1">Device ID (enter this in the mobile app)</p>
              <div className="flex items-center justify-between gap-3">
                <code className="text-sm font-mono text-primary font-bold break-all">{created.deviceId}</code>
                <button onClick={copyId} className="p-2 hover:bg-gray-200 rounded-lg flex-shrink-0 transition-colors">
                  {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} className="text-gray-500" />}
                </button>
              </div>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700 mb-6">
              <p className="font-semibold mb-1">Setup instructions:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-600">
                <li>Install ParentGuard app on child&apos;s phone</li>
                <li>Open the app and tap &quot;Login&quot;</li>
                <li>Use your parent account credentials</li>
                <li>The device ID above will auto-link the phone</li>
              </ol>
            </div>
            <button onClick={onClose} className="btn-primary w-full justify-center">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6 space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Device Name</label>
              <input value={form.deviceName} onChange={set('deviceName')} className="input" placeholder="e.g. Emma's Phone" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Device ID</label>
              <input value={form.deviceId} onChange={set('deviceId')} className="input font-mono" placeholder="Unique identifier for this device" />
              <p className="text-xs text-gray-400 mt-1">Found in the mobile app under Settings → Device Info</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
              <select value={form.role} onChange={set('role')} className="input">
                <option value="child">Child (monitored)</option>
                <option value="parent">Parent (monitor only)</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-outline flex-1 justify-center">Cancel</button>
              <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
                {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Add Device'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function DevicesPage() {
  const [devices, setDevices]   = useState<Device[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const plan = usePlan();

  useEffect(() => {
    devicesApi.list()
      .then((r) => setDevices(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const childDevices = devices.filter((d) => d.role === 'child');
  const atLimit      = childDevices.length >= plan.maxDevices;
  const canAdd       = !atLimit;

  async function handleDelete(deviceId: string, name: string) {
    // Step 1 — delete all collected data
    const step1 = await confirmDialog({
      title: `Delete data for "${name}"?`,
      text: 'This will permanently delete all locations, SMS, calls, notifications, gallery items and other collected data for this device.',
      confirmText: 'Yes, delete data',
      cancelText: 'Cancel',
      type: 'danger',
      theme: 'light',
    });
    if (!step1) return;

    setDeleting(deviceId);
    try {
      await devicesApi.deleteData(deviceId);
      toast.success(`All data for "${name}" deleted`);

      // Step 2 — ask to remove device registration
      const step2 = await stepConfirm({
        title: 'Data deleted!',
        text: `All monitoring data for "${name}" has been removed.\n\nDo you also want to remove the device registration?`,
        confirmText: 'Yes, remove device',
        cancelText: 'Keep device',
        theme: 'light',
      });

      if (step2) {
        await devicesApi.delete(deviceId);
        setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId));
        toast.success(`Device "${name}" removed`);
      }
    } catch {
      toast.error(`Failed to delete data for "${name}"`);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <Header title="Devices" subtitle="Manage all registered child devices" />

      <main className="flex-1 p-8 space-y-6">
        {/* Device limit bar */}
        <div className="card py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold text-gray-700">
                  Devices used
                </span>
                <span className="text-sm font-bold text-gray-900">
                  {childDevices.length} / {plan.maxDevices}
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    atLimit ? 'bg-red-500' : childDevices.length / plan.maxDevices >= 0.75 ? 'bg-yellow-400' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, (childDevices.length / plan.maxDevices) * 100)}%` }}
                />
              </div>
              {plan.planName && (
                <p className="text-xs text-gray-400 mt-1">{plan.planName} plan · {plan.maxDevices} device{plan.maxDevices !== 1 ? 's' : ''} allowed</p>
              )}
            </div>

            {canAdd ? (
              <button onClick={() => setShowModal(true)} className="btn-primary flex-shrink-0">
                <Plus size={18} /> Add Device
              </button>
            ) : (
              <Link href="/dashboard/subscription"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors flex-shrink-0">
                <Plus size={16} /> Upgrade Plan
              </Link>
            )}
          </div>
        </div>

        {/* Limit reached banner */}
        {atLimit && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <Smartphone size={18} className="text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Device limit reached</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Your <strong>{plan.planName}</strong> plan allows {plan.maxDevices} device{plan.maxDevices !== 1 ? 's' : ''}.
                Upgrade to add more.
              </p>
            </div>
            <Link href="/dashboard/subscription"
              className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2 flex-shrink-0">
              Upgrade →
            </Link>
          </div>
        )}

        {loading ? (
          <PageLoader />
        ) : devices.length === 0 ? (
          <div className="card text-center py-20">
            <Smartphone size={56} className="mx-auto mb-4 text-gray-200" />
            <h3 className="text-xl font-bold text-gray-700 mb-2">No devices yet</h3>
            <p className="text-gray-400 mb-6">Add your child&apos;s device to start monitoring</p>
            {canAdd && (
              <button onClick={() => setShowModal(true)} className="btn-primary mx-auto">
                <Plus size={18} /> Add First Device
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {devices.map((d) => (
              <div key={d.id} className="card hover:shadow-card-hover transition-shadow relative group">
                {/* Delete button */}
                <button
                  onClick={() => handleDelete(d.deviceId, d.name)}
                  disabled={deleting === d.deviceId}
                  title="Delete device data"
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-40"
                >
                  {deleting === d.deviceId
                    ? <span className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin block" />
                    : <Trash2 size={15} />}
                </button>

                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                    <Smartphone size={24} className="text-primary" />
                  </div>
                  <span className={d.isOnline ? 'badge-online' : 'badge-offline'}>
                    {d.isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                    {d.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>

                <h4 className="font-bold text-gray-900 text-base mb-0.5">{d.name}</h4>
                <p className="text-xs text-gray-400 font-mono mb-4 truncate">{d.deviceId}</p>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Role</span>
                    <span className="font-medium text-gray-800 capitalize">{d.role}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span className="flex items-center gap-1"><Clock size={13} /> Last seen</span>
                    <span className="font-medium text-gray-800">{timeAgo(d.lastSeen)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Registered</span>
                    <span className="font-medium text-gray-800">{new Date(d.registeredAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <AddDeviceModal
          onClose={() => setShowModal(false)}
          onAdded={(d) => setDevices((prev) => [...prev, d])}
        />
      )}
    </>
  );
}
