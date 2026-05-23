'use client';
import { useEffect, useState } from 'react';
import { MapPin, Plus, Trash2, ToggleLeft, ToggleRight, AlertTriangle, Loader } from 'lucide-react';
import Header from '@/components/Header';
import { devicesApi, userGeofencesApi } from '@/lib/api';
import MapPickerModal from '@/components/MapPickerModal';
import type { Device } from '@/types';
import PageLoader from '@/components/PageLoader';
import { confirmDialog } from '@/lib/confirm';
import { toast } from 'sonner';

interface GeofenceAlert { id: string; alertType: string; triggeredAt: string; }
interface Geofence {
  id: string; deviceId: string; name: string;
  latitude: number; longitude: number; radiusM: number;
  isActive: boolean; createdAt: string;
  alerts: GeofenceAlert[];
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

export default function GeofencingPage() {
  const [devices,   setDevices]   = useState<Device[]>([]);
  const [selected,  setSelected]  = useState('');
  const [zones,     setZones]     = useState<Geofence[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [showAdd,   setShowAdd]   = useState(false);
  const [toggling,  setToggling]  = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState<string | null>(null);

  useEffect(() => {
    devicesApi.list().then((r) => {
      const devs: Device[] = r.data;
      setDevices(devs);
      const first = devs.find((d) => d.role === 'child');
      if (first) setSelected(first.deviceId);
    });
  }, []);

  function fetchZones() {
    if (!selected) return;
    setLoading(true);
    userGeofencesApi.list(selected)
      .then((r) => setZones(r.data))
      .catch(() => setZones([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchZones(); }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleZone(z: Geofence) {
    setToggling(z.id);
    try {
      await userGeofencesApi.update(z.id, { isActive: !z.isActive });
      setZones((prev) => prev.map((g) => g.id === z.id ? { ...g, isActive: !z.isActive } : g));
    } finally { setToggling(null); }
  }

  async function deleteZone(id: string) {
    const zone = zones.find((z) => z.id === id);
    const ok = await confirmDialog({
      title: `Delete zone "${zone?.name ?? ''}"?`,
      text: 'This geofence zone will be permanently removed.',
      confirmText: 'Delete Zone',
      type: 'danger',
    });
    if (!ok) return;
    setDeleting(id);
    try {
      await userGeofencesApi.delete(id);
      setZones((prev) => prev.filter((g) => g.id !== id));
      toast.success(`Zone "${zone?.name}" deleted`);
    } catch {
      toast.error('Failed to delete zone');
    } finally { setDeleting(null); }
  }

  async function handleCreate(data: { name: string; latitude: number; longitude: number; radiusM: number }) {
    await userGeofencesApi.create({ deviceId: selected, ...data });
    setShowAdd(false);
    fetchZones();
    toast.success(`Zone "${data.name}" created`);
  }

  const activeCount = zones.filter((z) => z.isActive).length;

  return (
    <>
      <Header title="Geo Fencing" subtitle="Set location alerts for child's device" />

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
                <span className="font-semibold text-gray-800">{activeCount}</span> active / {zones.length} total
              </span>
              <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
                <Plus size={15} /> Add Zone
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <PageLoader />
        ) : zones.length === 0 ? (
          <div className="card text-center py-20">
            <MapPin size={56} className="mx-auto mb-4 text-gray-200" />
            <h3 className="text-lg font-bold text-gray-600">No geofence zones</h3>
            <p className="text-gray-400 mt-1 mb-6">Add a zone to get alerts when the device enters or leaves the area</p>
            <button onClick={() => setShowAdd(true)} className="btn-primary mx-auto flex items-center gap-2">
              <Plus size={15} /> Add Your First Zone
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {zones.map((z) => (
              <div key={z.id} className="card hover:shadow-card-hover transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                      ${z.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <MapPin size={18} className={z.isActive ? 'text-green-600' : 'text-gray-400'} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{z.name}</p>
                      <p className="text-xs text-gray-400">
                        {z.latitude.toFixed(4)}, {z.longitude.toFixed(4)} · {z.radiusM >= 1000 ? `${(z.radiusM / 1000).toFixed(1)} km` : `${z.radiusM} m`} radius
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleZone(z)} disabled={toggling === z.id}
                      className="text-gray-400 hover:text-primary transition-colors">
                      {toggling === z.id
                        ? <Loader size={18} className="animate-spin" />
                        : z.isActive
                          ? <ToggleRight size={22} className="text-green-500" />
                          : <ToggleLeft size={22} />}
                    </button>
                    <button onClick={() => deleteZone(z.id)} disabled={deleting === z.id}
                      className="text-gray-300 hover:text-red-500 transition-colors">
                      {deleting === z.id
                        ? <Loader size={15} className="animate-spin" />
                        : <Trash2 size={15} />}
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                    ${z.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {z.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-xs text-gray-400">Created {fmtDate(z.createdAt)}</span>
                </div>

                {z.alerts.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                      <AlertTriangle size={11} className="text-orange-400" /> Recent Alerts
                    </p>
                    {z.alerts.slice(0, 3).map((a) => (
                      <div key={a.id} className="text-xs text-gray-500 flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded capitalize font-medium
                          ${a.alertType === 'enter' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                          {a.alertType}
                        </span>
                        <span>{new Date(a.triggeredAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {showAdd && (
        <MapPickerModal
          onClose={() => setShowAdd(false)}
          onConfirm={handleCreate}
        />
      )}
    </>
  );
}
