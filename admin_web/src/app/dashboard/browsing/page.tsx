'use client';
import { useEffect, useState } from 'react';
import { Globe, Search, ExternalLink } from 'lucide-react';
import Header from '@/components/Header';
import { devicesApi, userBrowsingApi } from '@/lib/api';
import type { Device } from '@/types';
import PageLoader from '@/components/PageLoader';

interface BrowsingEntry {
  id: string; deviceId: string;
  url: string; title: string | null;
  browserApp: string | null; visitedAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function domain(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url.slice(0, 40); }
}

const BROWSER_COLORS: Record<string, string> = {
  chrome:  'bg-green-100 text-green-700',
  firefox: 'bg-orange-100 text-orange-700',
  samsung: 'bg-blue-100 text-blue-700',
  opera:   'bg-red-100 text-red-700',
  brave:   'bg-orange-100 text-orange-800',
  edge:    'bg-indigo-100 text-indigo-700',
};
function browserColor(b: string | null): string {
  if (!b) return 'bg-gray-100 text-gray-600';
  const key = b.toLowerCase();
  for (const k of Object.keys(BROWSER_COLORS)) if (key.includes(k)) return BROWSER_COLORS[k];
  return 'bg-gray-100 text-gray-600';
}

export default function BrowsingPage() {
  const [devices, setDevices]  = useState<Device[]>([]);
  const [selected, setSelected] = useState('');
  const [entries, setEntries]  = useState<BrowsingEntry[]>([]);
  const [search, setSearch]    = useState('');
  const [loading, setLoading]  = useState(false);
  const [limit, setLimit]      = useState(200);

  useEffect(() => {
    devicesApi.list().then((r) => {
      const devs: Device[] = r.data;
      setDevices(devs);
      const first = devs.find((d) => d.role === 'child');
      if (first) setSelected(first.deviceId);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    userBrowsingApi.list(selected, limit, search || undefined)
      .then((r) => setEntries(r.data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [selected, limit, search]);

  // Group by date
  const grouped = entries.reduce<Record<string, BrowsingEntry[]>>((acc, e) => {
    const key = new Date(e.visitedAt).toLocaleDateString('en-IN', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
    (acc[key] ??= []).push(e);
    return acc;
  }, {});

  return (
    <>
      <Header title="Browsing History" subtitle="Websites visited on child's device" />

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

            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <Search size={16} className="text-gray-400 flex-shrink-0" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                className="input" placeholder="Search URL or title…" />
            </div>

            <div className="ml-auto text-sm text-gray-400">
              <span className="font-semibold text-gray-700">{entries.length}</span> visits
            </div>
          </div>
        </div>

        {loading ? (
          <PageLoader />
        ) : entries.length === 0 ? (
          <div className="card text-center py-20">
            <Globe size={56} className="mx-auto mb-4 text-gray-200" />
            <h3 className="text-lg font-bold text-gray-600">No browsing history</h3>
            <p className="text-gray-400 mt-1">
              {search ? 'No results match your search' : 'Browsing history will appear here once captured'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, dayEntries]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{date}</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                <div className="card divide-y divide-gray-100">
                  {dayEntries.map((e) => (
                    <div key={e.id} className="flex items-start gap-3 py-3 px-1 hover:bg-gray-50 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${domain(e.url)}&sz=32`}
                          alt=""
                          width={16} height={16}
                          onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {e.title && (
                            <p className="text-sm font-semibold text-gray-900 truncate">{e.title}</p>
                          )}
                          {e.browserApp && (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${browserColor(e.browserApp)}`}>
                              {e.browserApp}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{e.url}</p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-400">{timeAgo(e.visitedAt)}</span>
                        <a href={e.url} target="_blank" rel="noopener noreferrer"
                          className="text-gray-300 hover:text-primary transition-colors"
                          onClick={(ev) => ev.stopPropagation()}>
                          <ExternalLink size={13} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {entries.length >= limit && (
              <div className="text-center">
                <button onClick={() => setLimit((l) => l + 200)}
                  className="btn-outline mx-auto">
                  Load more
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
