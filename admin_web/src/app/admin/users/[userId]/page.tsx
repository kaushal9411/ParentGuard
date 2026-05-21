'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users, Smartphone, Wifi, WifiOff, Trash2, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import PageLoader from '@/components/PageLoader';

interface Device { id: string; name: string; role: string; isOnline: boolean; lastSeen: string | null; }
interface User {
  id: string; name: string; email: string; role: string; createdAt: string;
  devices: Device[];
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers]       = useState<User[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [pages, setPages]       = useState(1);
  const [search, setSearch]     = useState('');
  const [query, setQuery]       = useState('');
  const [loading, setLoading]   = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.users({ search: query || undefined, page });
      setUsers(res.data.users);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } finally {
      setLoading(false);
    }
  }, [query, page]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery(search);
    setPage(1);
  }

  async function deleteUser(id: string, name: string) {
    if (!confirm(`Delete user "${name}" and ALL their data? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await adminApi.deleteUser(id);
      setUsers((u) => u.filter((x) => x.id !== id));
      setTotal((t) => t - 1);
    } catch {
      alert('Failed to delete user');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="flex-1 p-8 space-y-6">
      {/* Header */}
      <div className="border-b border-gray-800 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">All Users</h1>
          <p className="text-gray-500 mt-1">{total} registered accounts</p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder-gray-600" />
        </div>
        <button type="submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors">
          Search
        </button>
        {query && (
          <button type="button" onClick={() => { setQuery(''); setSearch(''); setPage(1); }}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
            Clear
          </button>
        )}
      </form>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {loading ? (
          <PageLoader theme="dark" />
        ) : users.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Users size={48} className="mx-auto mb-3 opacity-20" />
            <p>{query ? 'No users match your search' : 'No users registered yet'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">User</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Role</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Devices</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Joined</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {users.map((u) => {
                  const childDevices = u.devices.filter((d) => d.role === 'child');
                  const anyOnline    = u.devices.some((d) => d.isOnline);
                  return (
                    <tr key={u.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-indigo-700 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-white font-semibold text-sm">{u.name}</p>
                            <p className="text-gray-500 text-xs">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize
                          ${u.role === 'parent' ? 'bg-blue-900/40 text-blue-300' : 'bg-purple-900/40 text-purple-300'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-gray-300 text-sm">
                          <Smartphone size={14} className="text-gray-500" />
                          {childDevices.length} child
                          {u.devices.length !== childDevices.length && (
                            <span className="text-gray-600">
                              / {u.devices.length - childDevices.length} parent
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {anyOnline ? (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-green-400">
                            <Wifi size={12} /> Online
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                            <WifiOff size={12} />
                            {timeAgo(u.devices[0]?.lastSeen ?? null)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm">
                        {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => router.push(`/admin/users/${u.id}`)}
                            className="p-2 hover:bg-indigo-600/20 text-gray-400 hover:text-indigo-300 rounded-lg transition-colors">
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => deleteUser(u.id, u.name)}
                            disabled={deleting === u.id}
                            className="p-2 hover:bg-red-900/30 text-gray-500 hover:text-red-400 rounded-lg transition-colors disabled:opacity-40">
                            {deleting === u.id
                              ? <span className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin block" />
                              : <Trash2 size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800">
            <p className="text-sm text-gray-500">
              Page {page} of {pages} · {total} users
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 rounded-lg transition-colors">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
                className="p-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 rounded-lg transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}