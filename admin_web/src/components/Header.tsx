'use client';
import { useEffect, useState, useCallback } from 'react';
import { Bell, User, RefreshCw, Menu } from 'lucide-react';
import { getUser } from '@/lib/auth';
import { devicesApi, userCommandsApi } from '@/lib/api';
import { toast } from 'sonner';
import { useMobileNav } from '@/context/MobileNavContext';

interface Props { title: string; subtitle?: string; }

export default function Header({ title, subtitle }: Props) {
  const [user,     setUser]     = useState<{ name: string; email: string } | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [syncing,  setSyncing]  = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const { toggle } = useMobileNav();

  useEffect(() => {
    setUser(getUser<{ name: string; email: string }>());
    devicesApi.list()
      .then((r) => {
        const first = (r.data as Array<{ deviceId: string; role: string }>)
          .find(d => d.role === 'child');
        if (first) setDeviceId(first.deviceId);
      })
      .catch(() => {});
  }, []);

  const sync = useCallback(async () => {
    if (!deviceId || syncing) return;
    setSyncing(true);
    try {
      await userCommandsApi.issue(deviceId, 'sync_now');
      toast.success('Syncing device… data will refresh in ~12 seconds');
      await new Promise(r => setTimeout(r, 12000));
      setLastSync(new Date());
      window.location.reload();
    } catch {
      toast.error('Sync failed — is the device online?');
      setSyncing(false);
    }
  }, [deviceId, syncing]);

  return (
    <header className="bg-white border-b border-gray-100 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={toggle} aria-label="Open menu"
          className="lg:hidden -ml-1 p-2 rounded-xl text-gray-600 hover:bg-gray-100 flex-shrink-0">
          <Menu size={22} />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Global sync button — auto-targets the first child device */}
        {deviceId && (
          <button
            onClick={sync}
            disabled={syncing}
            title={lastSync ? `Last synced at ${lastSync.toLocaleTimeString()}` : 'Pull fresh data from device now'}
            aria-label="Sync now"
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-all disabled:opacity-60 shadow-sm active:scale-95">
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{syncing ? 'Syncing…' : 'Sync Now'}</span>
          </button>
        )}

        <button className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <Bell size={20} className="text-gray-500" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full" />
        </button>

        <div className="flex items-center gap-3 pl-2 sm:pl-3 sm:border-l border-gray-200">
          <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
            <User size={18} className="text-white" />
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-semibold text-gray-900 leading-none">{user?.name ?? ''}</p>
            <p className="text-xs text-gray-500 mt-0.5">{user?.email ?? ''}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
