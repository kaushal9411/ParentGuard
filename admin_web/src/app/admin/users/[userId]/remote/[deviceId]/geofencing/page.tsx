'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Plus, Trash2, ToggleLeft, ToggleRight, AlertTriangle, Loader, Wifi, WifiOff } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import MapPickerModal from '@/components/MapPickerModal';
import { toast } from 'sonner';
import PageLoader from '@/components/PageLoader';

interface GeofenceAlert { id: string; alertType: string; triggeredAt: string; }
interface Geofence {
  id: string; name: string; latitude: number; longitude: number;
  radiusM: number; isActive: boolean; createdAt: string;
  alerts: GeofenceAlert[];
}
interface DeviceInfo { deviceId: string; name: string; isOnline: boolean; }

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

export default function AdminGeofencingPage() {
  const { userId, deviceId } = useParams<{ userId: string; deviceId: string }>();
  const router = useRouter();

  const [device,   setDevice]   = useState<DeviceInfo | null>(null);
  const [zones,    setZones]    = useState<Geofence[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showAdd,  setShowAdd]  = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    adminApi.userDetail(userId).then((r) => {
      setDevice(r.data.devices?.find((d: DeviceInfo) => d.deviceId === deviceId) ?? null);
    }).catch(() => {});
  }, [userId, deviceId]);

  function fetchZones() {
    setLoading(true);
    adminApi.deviceGeofences(deviceId)
      .then((r) => setZones(r.data))
      .catch(() => setZones([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchZones(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleZone(z: Geofence) {
    setToggling(z.id);
    try {
      await adminApi.toggleGeofence(z.id, !z.isActive);
      setZones((prev) => prev.map((g) => g.id === z.id ? { ...g, isActive: !z.isActive } : g));
    } finally { setToggling(null); }
  }

  async function deleteZone(id: string) {
    const zone = zones.find((z) => z.id === id);
    if (!confirm(`Delete zone "${zone?.name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await adminApi.deleteGeofence(id);
      setZones((prev) => prev.filter((g) => g.id !== id));
      toast.success(`Zone "${zone?.name}" deleted`);
    } catch {
      toast.error('Failed to delete zone');
    } finally { setDeleting(null); }
  }

  async function handleCreate(data: { name: string; latitude: number; longitude: number; radiusM: number }) {
    await adminApi.createGeofence(deviceId, data);
    setShowAdd(false);
    fetchZones();
    toast.success(`Zone "${data.name}" created`);
  }

  const activeCount = zones.filter((z) => z.isActive).length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-8 pt-8 pb-5 border-b border-gray-800">
        <button onClick={() => router.push(`/admin/users/${userId}/remote/${deviceId}`)}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors">
          <ArrowLeft size={15} /> Remote Access
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
              <MapPin size={20} className="text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white">Geofencing</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-gray-400 text-sm">{device?.name ?? deviceId}</span>
                {device?.isOnline
                  ? <span className="flex items-center gap-1 text-green-400 text-xs"><Wifi size={11} /> Live</span>
                  : <span className="flex items-center gap-1 text-gray-500 text-xs"><WifiOff size={11} /> Offline</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              <span className="font-semibold text-gray-300">{activeCount}</span> active / {zones.length} total
            </span>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors">
              <Plus size={15} /> Add Zone
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {loading ? <PageLoader theme="dark" /> : zones.length === 0 ? (
          <div className="text-center py-20">
            <MapPin size={52} className="mx-auto mb-4 text-gray-700" />
            <h3 className="text-lg font-bold text-gray-400">No geofence zones</h3>
            <p className="text-gray-600 mt-1 mb-6">Add a zone to get alerts when the device enters or leaves the area</p>
            <button onClick={() => setShowAdd(true)}
              className="mx-auto flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl">
              <Plus size={15} /> Add First Zone
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {zones.map((z) => (
              <div key={z.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                      ${z.isActive ? 'bg-green-500/20' : 'bg-gray-800'}`}>
                      <MapPin size={18} className={z.isActive ? 'text-green-400' : 'text-gray-600'} />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{z.name}</p>
                      <p className="text-xs text-gray-500">
                        {z.latitude.toFixed(4)}, {z.longitude.toFixed(4)} · {z.radiusM >= 1000 ? `${(z.radiusM / 1000).toFixed(1)} km` : `${z.radiusM} m`} radius
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleZone(z)} disabled={toggling === z.id}
                      className="text-gray-600 hover:text-gray-300 transition-colors">
                      {toggling === z.id
                        ? <Loader size={18} className="animate-spin" />
                        : z.isActive
                          ? <ToggleRight size={22} className="text-green-500" />
                          : <ToggleLeft size={22} />}
                    </button>
                    <button onClick={() => deleteZone(z.id)} disabled={deleting === z.id}
                      className="text-gray-700 hover:text-red-400 transition-colors">
                      {deleting === z.id
                        ? <Loader size={15} className="animate-spin" />
                        : <Trash2 size={15} />}
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                    ${z.isActive ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                    {z.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-xs text-gray-600">Created {fmtDate(z.createdAt)}</span>
                </div>

                {z.alerts.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                      <AlertTriangle size={11} className="text-orange-400" /> Recent Alerts
                    </p>
                    {z.alerts.slice(0, 3).map((a) => (
                      <div key={a.id} className="text-xs text-gray-500 flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded capitalize font-medium
                          ${a.alertType === 'enter' ? 'bg-green-900/40 text-green-400' : 'bg-orange-900/40 text-orange-400'}`}>
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
      </div>

      {showAdd && (
        <MapPickerModal
          dark
          onClose={() => setShowAdd(false)}
          onConfirm={handleCreate}
        />
      )}
    </div>
  );
}
