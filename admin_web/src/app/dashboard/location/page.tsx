'use client';
import { useEffect, useState } from 'react';
import { MapPin, Navigation, Clock, ExternalLink } from 'lucide-react';
import Header from '@/components/Header';
import { devicesApi, locationApi } from '@/lib/api';
import type { Device, LocationLog } from '@/types';
import PageLoader from '@/components/PageLoader';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function MapEmbed({ lat, lng }: { lat: number; lng: number }) {
  const url = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
  return (
    <iframe
      src={url} width="100%" height="100%"
      style={{ border: 0, borderRadius: '16px' }}
      allowFullScreen loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}

export default function LocationPage() {
  const [devices, setDevices]       = useState<Device[]>([]);
  const [selected, setSelected]     = useState('');
  const [logs, setLogs]             = useState<LocationLog[]>([]);
  const [loading, setLoading]       = useState(false);
  const [devLoading, setDevLoading] = useState(true);

  useEffect(() => {
    devicesApi.list()
      .then((r) => {
        const devs: Device[] = r.data;
        setDevices(devs);
        const first = devs.find((d) => d.role === 'child');
        if (first) setSelected(first.deviceId);
      })
      .finally(() => setDevLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    locationApi.history(selected, 50)
      .then((r) => setLogs(r.data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [selected]);

  const latest = logs[0];
  const mapsUrl = latest
    ? `https://www.google.com/maps?q=${latest.latitude},${latest.longitude}`
    : null;

  return (
    <>
      <Header title="Location" subtitle="Real-time GPS tracking" />

      <main className="flex-1 p-8 space-y-6">
        {/* Device selector */}
        <div className="card py-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Select Device:</label>
            <select value={selected} onChange={(e) => setSelected(e.target.value)}
              className="input max-w-xs" disabled={devLoading}>
              {devices.filter((d) => d.role === 'child').map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.name}</option>
              ))}
            </select>
            {latest && mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                className="btn-outline ml-auto text-sm">
                <ExternalLink size={15} /> Open in Google Maps
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Map */}
          <div className="xl:col-span-3 card p-0 overflow-hidden" style={{ height: '460px' }}>
            {loading ? (
              <PageLoader />
            ) : !latest ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                <MapPin size={48} className="opacity-20" />
                <p>No location data for this device</p>
              </div>
            ) : (
              <MapEmbed lat={latest.latitude} lng={latest.longitude} />
            )}
          </div>

          {/* Latest info + history */}
          <div className="xl:col-span-2 space-y-5">
            {/* Current location card */}
            {latest && (
              <div className="card">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Navigation size={18} className="text-primary" /> Current Location
                </h3>
                <div className="space-y-3 text-sm">
                  {[
                    { label: 'Latitude',  value: latest.latitude.toFixed(6) },
                    { label: 'Longitude', value: latest.longitude.toFixed(6) },
                    { label: 'Accuracy',  value: latest.accuracy ? `±${Math.round(latest.accuracy)}m` : '—' },
                    { label: 'Speed',     value: latest.speed ? `${latest.speed.toFixed(1)} m/s` : '—' },
                    { label: 'Address',   value: latest.address ?? '—' },
                    { label: 'Updated',   value: timeAgo(latest.capturedAt) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-start gap-2">
                      <span className="text-gray-500 flex-shrink-0">{label}</span>
                      <span className="font-medium text-gray-900 text-right break-all">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Location history */}
            <div className="card">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock size={18} className="text-gray-500" /> History
              </h3>
              {loading ? (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : logs.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">No history available</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {logs.map((l, i) => (
                    <div key={l.id} className={`flex items-center gap-3 p-3 rounded-xl text-sm ${i === 0 ? 'bg-primary/5 border border-primary/20' : 'bg-gray-50'}`}>
                      <MapPin size={14} className={i === 0 ? 'text-primary' : 'text-gray-400'} />
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-gray-600 truncate">
                          {l.latitude.toFixed(4)}, {l.longitude.toFixed(4)}
                        </p>
                        <p className="text-xs text-gray-400">{timeAgo(l.capturedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
