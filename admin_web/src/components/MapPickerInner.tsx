'use client';
import { useEffect, useRef } from 'react';

interface Props {
  lat:       number | null;
  lng:       number | null;
  radius:    number;
  flyTarget: { lat: number; lng: number } | null;
  onMapClick: (lat: number, lng: number) => void;
  onMapReady: (map: unknown) => void;
}

export default function MapPickerInner({ lat, lng, radius, flyTarget, onMapClick, onMapReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef    = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circleRef = useRef<any>(null);

  // Initialise Leaflet once (client-side only via dynamic import)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require('leaflet');
    require('leaflet/dist/leaflet.css');

    // Fix broken marker icons in webpack/Next.js builds
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const map = L.map(containerRef.current).setView([20.5937, 78.9629], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    onMapReady(map);

    return () => {
      map.remove();
      mapRef.current  = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update marker + circle whenever pin position or radius changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require('leaflet');

    markerRef.current?.remove(); markerRef.current = null;
    circleRef.current?.remove(); circleRef.current = null;

    if (lat !== null && lng !== null) {
      markerRef.current = L.marker([lat, lng]).addTo(map);
      circleRef.current = L.circle([lat, lng], {
        radius,
        color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.15, weight: 2,
      }).addTo(map);
    }
  }, [lat, lng, radius]);

  // Fly to searched location
  useEffect(() => {
    if (!flyTarget || !mapRef.current) return;
    mapRef.current.flyTo([flyTarget.lat, flyTarget.lng], 15, { duration: 1 });
  }, [flyTarget]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}
