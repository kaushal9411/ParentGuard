'use client';
import { useEffect, useState, useCallback } from 'react';
import { Bell, User, RefreshCw } from 'lucide-react';
import { getUser } from '@/lib/auth';
import { devicesApi, userCommandsApi } from '@/lib/api';
import { toast } from 'sonner';

interface Props { title: string; subtitle?: string; }

export default function Header({ title, subtitle }: Props) {
  const [user,     setUser]     = useState<{ name: string; email: string } | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [syncing,  setSyncing]  = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

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
    <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Global sync button — auto-targets the first child device */}
        {deviceId && (
          <button
            onClick={sync}
            disabled={syncing}
            title={lastSync ? `Last synced at ${lastSync.toLocaleTimeString()}` : 'Pull fresh data from device now'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-all disabled:opacity-60 shadow-sm active:scale-95">
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        )}

        <button className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <Bell size={20} className="text-gray-500" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full" />
        </button>

        <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
          <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center">
            <User size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-none">{user?.name ?? ''}</p>
            <p className="text-xs text-gray-500 mt-0.5">{user?.email ?? ''}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
