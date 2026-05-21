'use client';
import { useEffect, useState, useCallback } from 'react';
import { Image, Video, X, Download, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import Header from '@/components/Header';
import { devicesApi, userGalleryApi } from '@/lib/api';
import type { Device } from '@/types';
import PageLoader from '@/components/PageLoader';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

interface GalleryItem {
  id: string; deviceId: string; fileName: string;
  mimeType: string; sizeBytes: string;
  takenAt: string | null; syncedAt: string;
  imageUrl: string | null; thumbnail: string | null;
}

function mediaSrc(item: GalleryItem): string | null {
  if (item.imageUrl) return `${API_URL}${item.imageUrl}`;
  if (item.thumbnail) return `data:image/jpeg;base64,${item.thumbnail}`;
  return null;
}

function isVideo(mimeType: string) { return mimeType.startsWith('video/'); }

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtSize(bytes: string) {
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({ items, index, onClose }: {
  items: GalleryItem[]; index: number; onClose: () => void;
}) {
  const [cur, setCur] = useState(index);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft')  setCur((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setCur((i) => Math.min(items.length - 1, i + 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items.length, onClose]);

  const item = items[cur];
  const src  = mediaSrc(item);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={onClose}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="text-white text-sm">
          <span className="font-semibold">{item.fileName}</span>
          <span className="ml-3 text-gray-400">{fmtDate(item.takenAt ?? item.syncedAt)}</span>
          <span className="ml-3 text-gray-400">{fmtSize(item.sizeBytes)}</span>
        </div>
        <div className="flex items-center gap-3">
          {(item.imageUrl || item.thumbnail) && (
            <a
              href={item.imageUrl ? `${API_URL}${item.imageUrl}` : src!}
              download={item.fileName}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
              onClick={(e) => e.stopPropagation()}>
              <Download size={14} /> Download
            </a>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={22} />
          </button>
        </div>
      </div>

      {/* Media */}
      <div className="flex-1 flex items-center justify-center relative min-h-0 px-16" onClick={(e) => e.stopPropagation()}>
        {cur > 0 && (
          <button onClick={() => setCur((i) => i - 1)}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-colors">
            <ChevronLeft size={20} />
          </button>
        )}

        {isVideo(item.mimeType) ? (
          item.imageUrl ? (
            // Full video file uploaded — use native video player
            <video key={item.imageUrl} controls autoPlay
              className="max-h-full max-w-full rounded-xl"
              style={{ maxHeight: 'calc(100vh - 160px)' }}>
              <source src={`${API_URL}${item.imageUrl}`} type={item.mimeType} />
              Your browser does not support video playback.
            </video>
          ) : src ? (
            // Only thumbnail available — show it with a notice
            <div className="flex flex-col items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={item.fileName}
                className="max-h-64 max-w-full rounded-xl object-contain opacity-60" />
              <div className="flex items-center gap-2 bg-yellow-900/40 border border-yellow-700/40 text-yellow-300 text-sm px-4 py-2 rounded-xl">
                <Video size={14} /> Video not yet uploaded — showing thumbnail only
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-center">
              <Video size={48} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Video not yet uploaded</p>
            </div>
          )
        ) : src ? (
          // Photo
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={item.fileName}
            className="max-h-full max-w-full rounded-xl object-contain"
            style={{ maxHeight: 'calc(100vh - 160px)' }} />
        ) : (
          <div className="text-gray-500 text-center">
            <Image size={48} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Media not yet uploaded</p>
          </div>
        )}

        {cur < items.length - 1 && (
          <button onClick={() => setCur((i) => i + 1)}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-colors">
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {/* Counter */}
      <div className="text-center py-3 text-gray-500 text-xs flex-shrink-0">
        {cur + 1} / {items.length}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GalleryPage() {
  const [devices, setDevices]  = useState<Device[]>([]);
  const [selected, setSelected] = useState('');
  const [items, setItems]      = useState<GalleryItem[]>([]);
  const [filter, setFilter]    = useState<'all' | 'image' | 'video'>('all');
  const [loading, setLoading]  = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    devicesApi.list().then((r) => {
      const devs: Device[] = r.data;
      setDevices(devs);
      const first = devs.find((d) => d.role === 'child');
      if (first) setSelected(first.deviceId);
    });
  }, []);

  const fetchGallery = useCallback(() => {
    if (!selected) return;
    setLoading(true);
    const type = filter === 'all' ? undefined : filter;
    userGalleryApi.list(selected, type as 'image' | 'video' | undefined)
      .then((r) => setItems(r.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [selected, filter]);

  useEffect(() => { fetchGallery(); }, [fetchGallery]);

  // Group by date (taken or synced)
  const grouped = items.reduce<Record<string, GalleryItem[]>>((acc, item) => {
    const key = new Date(item.takenAt ?? item.syncedAt).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    (acc[key] ??= []).push(item);
    return acc;
  }, {});

  const photos = items.filter((i) => !isVideo(i.mimeType)).length;
  const videos = items.filter((i) =>  isVideo(i.mimeType)).length;

  return (
    <>
      <Header title="Gallery" subtitle="Photos and videos from child's device" />

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

            {/* Filter tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {(['all', 'image', 'video'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize
                    ${filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {f === 'all' ? 'All' : f === 'image' ? `Photos (${photos})` : `Videos (${videos})`}
                </button>
              ))}
            </div>

            <div className="ml-auto text-sm text-gray-400">
              <span className="font-semibold text-gray-700">{items.length}</span> items
            </div>
          </div>
        </div>

        {loading ? (
          <PageLoader />
        ) : items.length === 0 ? (
          <div className="card text-center py-20">
            <Image size={56} className="mx-auto mb-4 text-gray-200" />
            <h3 className="text-lg font-bold text-gray-600">No media found</h3>
            <p className="text-gray-400 mt-1">Gallery will appear here once the app syncs media metadata</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([date, dayItems]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{date}</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {dayItems.map((item) => {
                    const src = mediaSrc(item);
                    const globalIdx = items.indexOf(item);
                    return (
                      <button key={item.id} onClick={() => setLightbox(globalIdx)}
                        className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 group hover:ring-2 hover:ring-primary transition-all">
                        {src ? (
                          // Always render thumbnail as <img> — works for both photos and video thumbnails (base64 JPEG).
                          // Videos: thumbnail is a JPEG keyframe, not playable in <video>, so <img> is correct here.
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt={item.fileName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                            {isVideo(item.mimeType) && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <div className="bg-black/60 rounded-full p-2">
                                  <Video size={18} className="text-white" />
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-1">
                            {isVideo(item.mimeType)
                              ? <Video size={24} />
                              : <Image size={24} />}
                            <span className="text-[10px]">Uploading…</span>
                          </div>
                        )}
                        {isVideo(item.mimeType) && (
                          <div className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">
                            VIDEO
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {lightbox !== null && (
        <Lightbox items={items} index={lightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}
