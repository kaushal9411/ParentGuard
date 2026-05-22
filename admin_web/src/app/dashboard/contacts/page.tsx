'use client';
import { useEffect, useState } from 'react';
import { Users, Search, Phone, Mail } from 'lucide-react';
import Header from '@/components/Header';
import { devicesApi, userContactsApi } from '@/lib/api';
import PageLoader from '@/components/PageLoader';
import type { Device } from '@/types';

interface Contact {
  id: string; deviceId: string;
  name: string; phones: string; emails: string | null;
}

function parseList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed))
      return parsed.map((p) => (typeof p === 'string' ? p : (p?.number ?? p?.address ?? '')));
  } catch {}
  return raw ? [raw] : [];
}

export default function ContactsPage() {
  const [devices, setDevices]   = useState<Device[]>([]);
  const [selected, setSelected] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [limit, setLimit]       = useState(500);

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
    userContactsApi.list(selected, limit, search || undefined)
      .then((r) => setContacts(r.data))
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, [selected, limit, search]);

  return (
    <>
      <Header title="Contacts" subtitle="Device address book" />
      <main className="flex-1 p-8 space-y-6">

        {/* Device selector */}
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
          </div>
        </div>

        {loading ? <PageLoader /> : (
          <div className="card p-6">
            {/* Header row */}
            <div className="flex items-center gap-3 mb-5">
              <Users size={18} className="text-primary" />
              <h3 className="font-bold text-gray-900">Contacts</h3>
              <span className="ml-1 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{contacts.length}</span>
              <div className="ml-auto relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or number…"
                  className="input pl-7 text-sm w-52" />
              </div>
            </div>

            {contacts.length === 0 ? (
              <div className="text-center py-16">
                <Users size={48} className="mx-auto mb-3 text-gray-200" />
                <p className="text-gray-500 font-medium">No contacts</p>
                <p className="text-gray-400 text-sm mt-1">
                  {search ? 'No results match your search' : 'Contacts will appear here once synced'}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {contacts.map((c) => {
                    const phones = parseList(c.phones);
                    const emails = parseList(c.emails);
                    return (
                      <div key={c.id} className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex items-start gap-3 hover:bg-gray-100 transition-colors">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 text-sm truncate">{c.name}</p>
                          {phones.map((p, i) => (
                            <p key={i} className="text-gray-500 text-xs flex items-center gap-1 mt-0.5">
                              <Phone size={10} className="text-gray-400" /> {p}
                            </p>
                          ))}
                          {emails.map((e, i) => (
                            <p key={i} className="text-gray-500 text-xs flex items-center gap-1 mt-0.5">
                              <Mail size={10} className="text-gray-400" /> {e}
                            </p>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {contacts.length >= limit && (
                  <div className="text-center pt-4 border-t border-gray-100 mt-4">
                    <button onClick={() => setLimit((l) => l + 500)} className="text-sm text-primary hover:underline">
                      Load more
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </>
  );
}
