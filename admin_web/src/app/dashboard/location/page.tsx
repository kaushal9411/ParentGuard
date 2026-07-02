'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { MapPin, Navigation, Clock, ExternalLink, Radio, Loader } from 'lucide-react';
import Header from '@/components/Header';
import { devicesApi, locationApi, userCommandsApi } from '@/lib/api';
import type { Device, LocationLog } from '@/types';
import PageLoader from '@/components/PageLoader';
import { toast } from 'sonner';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}

function MapEmbed({ lat, lng }: { lat: number; lng: number }) {
  const url = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
  return (
    <iframe
      key={`${lat},${lng}`}
      src={url} width="100%" height="100%"
      style={{ border: 0, borderRadius: '16px' }}
      allowFullScreen loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}

export default function LocationPage() {
  const [devices,    setDevices]    = useState<Device[]>([]);
  const [selected,   setSelected]   = useState('');
  const [logs,       setLogs]       = useState<LocationLog[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [devLoading, setDevLoading] = useState(true);
  const [pinned,     setPinned]     = useState<LocationLog | null>(null);
  const [live,       setLive]       = useState(false);
  const [busy,       setBusy]       = useState(false);

  // Track whether the user is "following" the latest fix (vs. inspecting an old one).
  const latestIdRef = useRef<string>('');
  const pinnedIdRef = useRef<string | undefined>(undefined);
  useEffect(() => { pinnedIdRef.current = pinned?.id; }, [pinned]);

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

  const refresh = useCallback(async (devId: string, showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    try {
      const r = await locationApi.history(devId, 50);
      const data: LocationLog[] = r.data;
      const wasFollowing = !pinnedIdRef.current || pinnedIdRef.current === latestIdRef.current;
      setLogs(data);
      if (wasFollowing && data.length > 0) setPinned(data[0]);
      latestIdRef.current = data[0]?.id ?? '';
    } catch {
      if (showSpinner) setLogs([]);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  // Initial + on device change
  useEffect(() => {
    if (!selected) return;
    setPinned(null);
    pinnedIdRef.current = undefined;
    latestIdRef.current = '';
    refresh(selected, true);
  }, [selected, refresh]);

  // Live auto-refresh loop
  useEffect(() => {
    if (!selected || !live) return;
    const t = setInterval(() => refresh(selected, false), 8000);
    return () => clearInterval(t);
  }, [selected, live, refresh]);

  async function toggleLive() {
    if (!selected) return;
    setBusy(true);
    try {
      if (!live) {
        await userCommandsApi.issue(selected, 'start_live_location', { durationMinutes: 5 });
        setLive(true);
        toast.success('Live tracking started — following the child for 5 minutes');
      } else {
        await userCommandsApi.issue(selected, 'stop_live_location');
        setLive(false);
        toast.success('Live tracking stopped');
      }
    } catch {
      toast.error('Failed to change live tracking');
    } finally {
      setBusy(false);
    }
  }

  const mapsUrl = pinned
    ? `https://www.google.com/maps?q=${pinned.latitude},${pinned.longitude}`
    : null;

  const isLatest = pinned?.id === logs[0]?.id;

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
            <button onClick={toggleLive} disabled={busy || !selected}
              className={`ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 ${
                live ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              {busy ? <Loader size={15} className="animate-spin" />
                    : <Radio size={15} className={live ? 'animate-pulse' : ''} />}
              {live ? 'Stop Live' : 'Start Live Tracking'}
            </button>
            {pinned && mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                className="btn-outline flex items-center gap-1.5 text-sm">
                <ExternalLink size={15} /> Open in Google Maps
              </a>
            )}
          </div>
          {live && (
            <p className="mt-2 text-xs text-emerald-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live — map updates every ~10s and follows the newest location.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Map */}
          <div className="xl:col-span-3 card p-0 overflow-hidden" style={{ height: '460px' }}>
            {loading ? (
              <PageLoader />
            ) : !pinned ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                <MapPin size={48} className="opacity-20" />
                <p>No location data for this device</p>
              </div>
            ) : (
              <MapEmbed lat={pinned.latitude} lng={pinned.longitude} />
            )}
          </div>

          {/* Right panel */}
          <div className="xl:col-span-2 space-y-4">
            {/* Selected location info */}
            {pinned && (
              <div className="card">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Navigation size={18} className="text-primary" />
                  {isLatest ? 'Current Location' : 'Selected Location'}
                  {!isLatest && (
                    <button onClick={() => setPinned(logs[0])}
                      className="ml-auto text-xs text-primary hover:underline font-normal">
                      ← Back to latest
                    </button>
                  )}
                </h3>
                <div className="space-y-2.5 text-sm">
                  {[
                    { label: 'Latitude',  value: pinned.latitude.toFixed(6) },
                    { label: 'Longitude', value: pinned.longitude.toFixed(6) },
                    { label: 'Accuracy',  value: pinned.accuracy ? `±${Math.round(pinned.accuracy)}m` : '—' },
                    { label: 'Speed',     value: pinned.speed ? `${pinned.speed.toFixed(1)} m/s` : '—' },
                    { label: 'Address',   value: pinned.address ?? '—' },
                    { label: 'Time',      value: fmtTime(pinned.capturedAt) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-start gap-2">
                      <span className="text-gray-500 flex-shrink-0">{label}</span>
                      <span className="font-medium text-gray-900 text-right break-all">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Location history — clickable */}
            <div className="card">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Clock size={18} className="text-gray-500" /> History
                <span className="ml-auto text-xs text-gray-400 font-normal">Click to view on map</span>
              </h3>
              {loading ? (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : logs.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">No history available</p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {logs.map((l) => {
                    const isSelected = pinned?.id === l.id;
                    return (
                      <button
                        key={l.id}
                        onClick={() => setPinned(l)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm text-left transition-all
                          ${isSelected
                            ? 'bg-primary/10 border border-primary/30 ring-1 ring-primary/20'
                            : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                          }`}
                      >
                        <MapPin size={14} className={isSelected ? 'text-primary flex-shrink-0' : 'text-gray-400 flex-shrink-0'} />
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs text-gray-700 truncate">
                            {l.latitude.toFixed(5)}, {l.longitude.toFixed(5)}
                          </p>
                          {l.address && (
                            <p className="text-xs text-gray-500 truncate">{l.address}</p>
                          )}
                          <p className="text-xs text-gray-400">{timeAgo(l.capturedAt)} · {fmtTime(l.capturedAt)}</p>
                        </div>
                        {isSelected && (
                          <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
