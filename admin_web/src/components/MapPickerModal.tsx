'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { X, Search, Loader, MapPin, Plus, Minus } from 'lucide-react';

const MapPickerInner = dynamic(() => import('./MapPickerInner'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1f2937' }}>
      <Loader size={20} className="animate-spin" style={{ color: '#6b7280' }} />
    </div>
  ),
});

interface NominatimResult { display_name: string; lat: string; lon: string; }
interface Props {
  onClose:   () => void;
  onConfirm: (data: { name: string; latitude: number; longitude: number; radiusM: number }) => Promise<void>;
  dark?:     boolean;
}

const PRESETS = [100, 250, 500, 1000, 2000, 5000];

function labelPreset(v: number) {
  return v >= 1000 ? `${v / 1000} km` : `${v} m`;
}

export default function MapPickerModal({ onClose, onConfirm, dark = false }: Props) {
  const [mounted,   setMounted]   = useState(false);
  const [name,      setName]      = useState('');
  const [lat,       setLat]       = useState<number | null>(null);
  const [lng,       setLng]       = useState<number | null>(null);
  const [radius,    setRadius]    = useState(500);
  const [search,    setSearch]    = useState('');
  const [searching, setSearching] = useState(false);
  const [results,   setResults]   = useState<NominatimResult[]>([]);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => { setMounted(true); }, []);

  async function doSearch() {
    if (!search.trim()) return;
    setSearching(true); setResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&limit=5`,
        { headers: { Accept: 'application/json' } },
      );
      setResults(await res.json());
    } catch { setResults([]); }
    finally { setSearching(false); }
  }

  function selectResult(r: NominatimResult) {
    const newLat = parseFloat(r.lat), newLng = parseFloat(r.lon);
    setLat(newLat); setLng(newLng);
    setFlyTarget({ lat: newLat, lng: newLng });
    setResults([]); setSearch('');
  }

  async function submit() {
    if (!name.trim())                { setError('Zone name is required'); return; }
    if (lat === null || lng === null) { setError('Click the map to place the zone center'); return; }
    setSaving(true); setError('');
    try {
      await onConfirm({ name: name.trim(), latitude: lat, longitude: lng, radiusM: radius });
    } catch {
      setError('Failed to save zone');
      setSaving(false);
    }
  }

  // ── colours ───────────────────────────────────────────────────────────────
  const bg       = dark ? '#0d1117' : '#ffffff';
  const surface  = dark ? '#161b22' : '#f9fafb';
  const bdrClr   = dark ? '#30363d' : '#e5e7eb';
  const txtMain  = dark ? '#f0f6fc' : '#111827';
  const txtSub   = dark ? '#8b949e' : '#6b7280';
  const txtLbl   = dark ? '#c9d1d9' : '#374151';
  const inpBg    = dark ? '#0d1117' : '#ffffff';
  const inpBdr   = dark ? '#30363d' : '#d1d5db';
  const dropBg   = dark ? '#161b22' : '#ffffff';
  const dropHov  = dark ? '#21262d' : '#f3f4f6';
  const green    = '#22c55e';
  const greenDk  = '#16a34a';

  const sharedInput: React.CSSProperties = {
    width: '100%', background: inpBg, border: `1px solid ${inpBdr}`,
    borderRadius: 10, padding: '9px 12px', fontSize: 14,
    color: txtMain, outline: 'none', boxSizing: 'border-box',
  };

  if (!mounted) return null;

  const modal = (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: bg, border: `1px solid ${bdrClr}`, borderRadius: 16, boxShadow: '0 32px 80px rgba(0,0,0,0.5)', width: '100%', maxWidth: 620, display: 'flex', flexDirection: 'column', maxHeight: '92vh', color: txtMain }}>

        {/* ── Header ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: `1px solid ${bdrClr}`, flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={16} style={{ color: green }} /> Add Geofence Zone
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: txtSub, padding: 4 }}><X size={18} /></button>
        </div>

        {/* ── Scrollable body ──────────────────────────────────── */}
        <div style={{ flex: '1 1 auto', overflowY: 'auto', minHeight: 0, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Zone name */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: txtLbl, marginBottom: 6 }}>Zone Name</div>
            <input value={name} onChange={(e) => setName(e.target.value)}
              style={sharedInput} placeholder="e.g. Home, School, Park" />
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: txtLbl, marginBottom: 6 }}>Search Location</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                style={{ ...sharedInput, flex: 1 }}
                placeholder="Type address or place name…"
              />
              <button onClick={doSearch} disabled={searching}
                style={{ flexShrink: 0, padding: '9px 16px', background: greenDk, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                {searching ? <Loader size={13} className="animate-spin" /> : <Search size={13} />}
                Search
              </button>
            </div>
            {results.length > 0 && (
              <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4, background: dropBg, border: `1px solid ${bdrClr}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 10, overflow: 'hidden' }}>
                {results.map((r, i) => (
                  <button key={i} onClick={() => selectResult(r)}
                    style={{ width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 12, color: txtSub, border: 'none', borderBottom: i < results.length - 1 ? `1px solid ${bdrClr}` : 'none', cursor: 'pointer', background: 'transparent', display: 'block' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = dropHov)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    {r.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Radius ──────────────────────────────────────────── */}
          <div style={{ background: surface, border: `1px solid ${bdrClr}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: txtLbl }}>Zone Radius</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: green }}>{radius >= 1000 ? `${radius / 1000} km` : `${radius} m`}</span>
            </div>

            {/* Preset buttons */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {PRESETS.map((p) => (
                <button key={p} onClick={() => setRadius(p)}
                  style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                    background: radius === p ? green : (dark ? '#21262d' : '#e5e7eb'),
                    color: radius === p ? '#fff' : txtSub,
                    transition: 'all 0.15s',
                  }}>
                  {labelPreset(p)}
                </button>
              ))}
            </div>

            {/* Fine adjustment */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setRadius(Math.max(50, radius - 50))}
                style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${bdrClr}`, background: dark ? '#21262d' : '#f3f4f6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: txtSub, flexShrink: 0 }}>
                <Minus size={14} />
              </button>
              <div style={{ flex: 1, height: 6, background: dark ? '#21262d' : '#e5e7eb', borderRadius: 3, position: 'relative', cursor: 'pointer' }}
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
                  setRadius(Math.round((50 + pct * 4950) / 50) * 50);
                }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 3, background: green, width: `${((radius - 50) / 4950) * 100}%` }} />
                <div style={{ position: 'absolute', top: '50%', left: `${((radius - 50) / 4950) * 100}%`, transform: 'translate(-50%,-50%)', width: 16, height: 16, borderRadius: '50%', background: green, border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
              </div>
              <button onClick={() => setRadius(Math.min(5000, radius + 50))}
                style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${bdrClr}`, background: dark ? '#21262d' : '#f3f4f6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: txtSub, flexShrink: 0 }}>
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Map */}
          <div>
            <div style={{ height: 200, borderRadius: 12, overflow: 'hidden', border: `1px solid ${bdrClr}` }}>
              <MapPickerInner
                lat={lat} lng={lng} radius={radius}
                flyTarget={flyTarget}
                onMapClick={(newLat, newLng) => { setLat(newLat); setLng(newLng); }}
                onMapReady={() => {}}
              />
            </div>
            <div style={{ textAlign: 'center', fontSize: 11, marginTop: 6, color: txtSub }}>
              {lat === null
                ? 'Click anywhere on the map to place the zone center'
                : <span>📍 <span style={{ color: green, fontWeight: 600 }}>{lat.toFixed(5)}, {lng!.toFixed(5)}</span> · click to reposition</span>
              }
            </div>
          </div>

        </div>

        {/* ── Footer ──────────────────────────────────────────── */}
        <div style={{ flexShrink: 0, padding: '16px 24px', borderTop: `1px solid ${bdrClr}` }}>
          {error && <div style={{ fontSize: 13, color: '#f87171', marginBottom: 10 }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={onClose}
              style={{ padding: '10px 22px', background: 'transparent', border: `1px solid ${bdrClr}`, color: txtSub, borderRadius: 10, fontSize: 14, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={submit} disabled={saving || lat === null}
              style={{ padding: '10px 22px', background: lat === null ? '#166534' : greenDk, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: lat === null ? 'not-allowed' : 'pointer', opacity: lat === null ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              {saving && <Loader size={14} className="animate-spin" />}
              Create Zone
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
