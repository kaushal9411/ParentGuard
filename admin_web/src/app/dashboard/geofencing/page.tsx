'use client';
import { useEffect, useState } from 'react';
import { MapPin, Plus, Trash2, ToggleLeft, ToggleRight, AlertTriangle, X, Loader } from 'lucide-react';
import Header from '@/components/Header';
import { devicesApi, userGeofencesApi } from '@/lib/api';
import type { Device } from '@/types';
import PageLoader from '@/components/PageLoader';
import { confirmDialog } from '@/lib/confirm';
import { toast } from 'sonner';

interface GeofenceAlert { id: string; type: string; triggeredAt: string; }
interface Geofence {
  id: string; deviceId: string; name: string;
  latitude: number; longitude: number; radiusM: number;
  isActive: boolean; createdAt: string;
  alerts: GeofenceAlert[];
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

function AddModal({ deviceId, onClose, onCreated }: {
  deviceId: string; onClose: () => void; onCreated: () => void;
}) {
  const [name, setName]       = useState('');
  const [lat,  setLat]        = useState('');
  const [lng,  setLng]        = useState('');
  const [radius, setRadius]   = useState('500');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const latitude  = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusM   = parseInt(radius, 10);
    if (!name || isNaN(latitude) || isNaN(longitude) || isNaN(radiusM)) {
      setError('All fields are required and must be valid numbers'); return;
    }
    setSaving(true);
    try {
      await userGeofencesApi.create({ deviceId, name, latitude, longitude, radiusM });
      onCreated();
    } catch { setError('Failed to create geofence'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Add Geofence</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Zone Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="input w-full" placeholder="e.g. Home, School, Park" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Latitude</label>
              <input value={lat} onChange={(e) => setLat(e.target.value)} type="number" step="any"
                className="input w-full" placeholder="e.g. 28.6139" required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Longitude</label>
              <input value={lng} onChange={(e) => setLng(e.target.value)} type="number" step="any"
                className="input w-full" placeholder="e.g. 77.2090" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Radius (meters)</label>
            <input value={radius} onChange={(e) => setRadius(e.target.value)} type="number" min="50" max="50000"
              className="input w-full" placeholder="500" required />
            <p className="text-xs text-gray-400 mt-1">Min 50m, max 50 km. A circle of this radius is drawn around the pin.</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-gray-400 bg-blue-50 rounded-lg px-3 py-2">
            Tip: Open Google Maps, right-click on a location and copy the coordinates.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              {saving && <Loader size={14} className="animate-spin" />} Create Zone
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function GeofencingPage() {
  const [devices, setDevices]   = useState<Device[]>([]);
  const [selected, setSelected]  = useState('');
  const [zones, setZones]        = useState<Geofence[]>([]);
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
      text: 'This geofence zone will be permanently removed from the device.',
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
              <button onClick={() => setShowAdd(true)}
                className="btn-primary flex items-center gap-2">
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
                        {z.latitude.toFixed(4)}, {z.longitude.toFixed(4)} · {z.radiusM}m radius
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

                {/* Status */}
                <div className="mt-3 flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                    ${z.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {z.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-xs text-gray-400">Created {fmtDate(z.createdAt)}</span>
                </div>

                {/* Recent alerts */}
                {z.alerts.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                      <AlertTriangle size={11} className="text-orange-400" /> Recent Alerts
                    </p>
                    {z.alerts.slice(0, 3).map((a) => (
                      <div key={a.id} className="text-xs text-gray-500 flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded capitalize font-medium
                          ${a.type === 'enter' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                          {a.type}
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
        <AddModal deviceId={selected} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); fetchZones(); }} />
      )}
    </>
  );
}
