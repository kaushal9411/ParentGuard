'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAdminLoggedIn, getAdminToken } from '@/lib/adminAuth';
import AdminSidebar from '@/components/AdminSidebar';
import RouteLoader from '@/components/RouteLoader';
import { Toaster, toast } from 'sonner';
import { Bell, X, Wifi, RefreshCw } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';

interface LiveAlert { deviceName: string; userId: string; source: 'ws' | 'fcm'; }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [alert,        setAlert]        = useState<LiveAlert | null>(null);
  const [wsLive,       setWsLive]       = useState(false);
  const [adminSyncing, setAdminSyncing] = useState(false);
  const [adminLastSync, setAdminLastSync] = useState<Date | null>(null);

  // Extract deviceId when on a device-specific admin page
  // Matches: /admin/users/<userId>/remote/<deviceId>/...
  const deviceMatch = pathname.match(/\/admin\/users\/([^/]+)\/remote\/([^/]+)/);
  const adminDeviceId = deviceMatch ? deviceMatch[2] : null;

  // ── Sync device data ──────────────────────────────────────────────────────
  const syncAdminDevice = useCallback(async () => {
    if (!adminDeviceId || adminSyncing) return;
    setAdminSyncing(true);
    try {
      await adminApi.issueCommand(adminDeviceId, 'sync_now');
      toast.success('Syncing device… data will refresh in ~12 seconds', { duration: 12000 });
      await new Promise(r => setTimeout(r, 12000));
      setAdminLastSync(new Date());
      window.location.reload();
    } catch {
      toast.error('Sync failed — is the device online?');
      setAdminSyncing(false);
    }
  }, [adminDeviceId, adminSyncing]);

  // ── Helper: show alert + dispatch re-fetch event ──────────────────────────
  const showAlert = useCallback((deviceName: string, userId: string, deviceId: string, source: 'ws' | 'fcm') => {
    setAlert({ deviceName, userId, source });
    setTimeout(() => setAlert((a) => (a?.userId === userId ? null : a)), 8000);
    window.dispatchEvent(
      new CustomEvent('pm:new-data', { detail: { userId, deviceId } }),
    );
  }, []);


  // ── Socket.IO real-time (primary — runs on same port as backend) ──────────
  const connectSocketIO = useCallback(async () => {
    try {
      const { io } = await import('socket.io-client');
      const socket = io(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000', {
        transports: ['websocket'],
        autoConnect: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
      });

      socket.on('connect', () => {
        setWsLive(true);
        socket.emit('join:admin');
      });

      socket.on('disconnect', () => setWsLive(false));
      socket.on('connect_error', () => setWsLive(false));

      socket.on('device:events', (data: {
        userId: string; deviceId: string; deviceName: string; types: string[];
      }) => {
        showAlert(data.deviceName ?? data.deviceId, data.userId, data.deviceId, 'ws');
      });
    } catch (e) {
      console.warn('[Socket.IO] connection failed:', e);
    }
  }, [showAlert]);

  // ── FCM push notifications (works even when browser tab is closed) ────────
  const registerFcm = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const { getFcmToken, getFirebaseMessaging, onMessage } = await import('@/lib/firebase');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const token = await getFcmToken();
      if (!token) return;

      const authToken = getAdminToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/fcm/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body:    JSON.stringify({ token }),
      });

      const messaging = getFirebaseMessaging();
      if (messaging) {
        onMessage(messaging, (payload) => {
          // Soketi may have already shown the alert — only show FCM if ws is down
          if (!wsLive) {
            showAlert(
              payload.data?.deviceName ?? 'device',
              payload.data?.userId ?? '',
              payload.data?.deviceId ?? '',
              'fcm',
            );
          }
        });
      }
    } catch (e) {
      console.warn('[FCM] setup failed:', e);
    }
  }, [showAlert, wsLive]);

  useEffect(() => {
    if (pathname !== '/admin/login' && !isAdminLoggedIn()) {
      router.replace('/admin/login');
      return;
    }
    if (pathname !== '/admin/login') {
      connectSocketIO();
      registerFcm();
    }
  }, [pathname, router, connectSocketIO, registerFcm]);

  if (pathname === '/admin/login') return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-gray-900">
      <RouteLoader />
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-gray-950">

        {/* Live alert banner */}
        {alert && (
          <div className="flex items-center gap-3 bg-indigo-600 px-5 py-2.5 text-white text-sm">
            <Bell size={15} className="flex-shrink-0" />
            <span className="flex-1">
              New activity from <strong>{alert.deviceName}</strong>
              <span className="ml-2 opacity-60 text-xs">
                via {alert.source === 'ws' ? 'live WebSocket' : 'push notification'}
              </span>
            </span>
            {alert.userId && (
              <button
                onClick={() => { router.push(`/admin/users/${alert.userId}`); setAlert(null); }}
                className="text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-full font-semibold transition-colors"
              >
                View
              </button>
            )}
            <button onClick={() => setAlert(null)} className="opacity-70 hover:opacity-100 transition-opacity">
              <X size={15} />
            </button>
          </div>
        )}

        {/* Sync bar — always visible; button activates when on a device page */}
        <div className="flex items-center justify-between bg-gray-900 border-b border-gray-800/60 px-6 py-2">
          <span className="text-xs text-gray-500">
            {adminDeviceId
              ? <>Device: <span className="text-gray-400 font-mono">{adminDeviceId.slice(0, 12)}…</span>
                  {adminLastSync && <span className="ml-2 text-gray-600">· Last synced {adminLastSync.toLocaleTimeString()}</span>}
                </>
              : 'Open a device page to sync'
            }
          </span>
          <button
            onClick={syncAdminDevice}
            disabled={adminSyncing || !adminDeviceId}
            title={!adminDeviceId ? 'Open a device page first' : 'Pull fresh data from this device'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-700 text-white text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95">
            <RefreshCw size={11} className={adminSyncing ? 'animate-spin' : ''} />
            {adminSyncing ? 'Syncing…' : 'Sync Device'}
          </button>
        </div>

        {children}

        <Toaster position="top-right" theme="dark" richColors closeButton />

        {/* WebSocket live indicator (bottom-right) */}
        <div className={`fixed bottom-4 right-4 flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all
          ${wsLive
            ? 'bg-green-950 border-green-800 text-green-400'
            : 'bg-gray-900 border-gray-700 text-gray-500'}`}
        >
          <Wifi size={11} />
          {wsLive ? 'Live' : 'Offline'}
        </div>
      </div>
    </div>
  );
}
