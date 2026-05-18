'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAdminLoggedIn, getAdminToken } from '@/lib/adminAuth';
import AdminSidebar from '@/components/AdminSidebar';
import { Bell, X } from 'lucide-react';

interface FcmAlert { deviceName: string; userId: string; }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [alert, setAlert] = useState<FcmAlert | null>(null);

  const registerFcm = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    try {
      const { getFcmToken, getFirebaseMessaging, onMessage } = await import('@/lib/firebase');

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const token = await getFcmToken();
      if (!token) return;

      // Register token with backend
      const authToken = getAdminToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/fcm/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body:    JSON.stringify({ token }),
      });

      // Handle foreground messages (tab is open)
      const messaging = getFirebaseMessaging();
      if (messaging) {
        onMessage(messaging, (payload) => {
          const deviceName = payload.data?.deviceName ?? 'device';
          const userId     = payload.data?.userId ?? '';
          setAlert({ deviceName, userId });

          // Auto-dismiss after 8 seconds
          setTimeout(() => setAlert((a) => (a?.userId === userId ? null : a)), 8000);

          // Dispatch event so the open user detail page can auto-refresh
          window.dispatchEvent(
            new CustomEvent('pm:new-data', { detail: { userId, deviceId: payload.data?.deviceId } }),
          );
        });
      }
    } catch (e) {
      console.warn('[FCM] setup failed:', e);
    }
  }, []);

  useEffect(() => {
    if (pathname !== '/admin/login' && !isAdminLoggedIn()) {
      router.replace('/admin/login');
      return;
    }
    if (pathname !== '/admin/login') {
      registerFcm();
    }
  }, [pathname, router, registerFcm]);

  if (pathname === '/admin/login') return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-gray-900">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 bg-gray-950">
        {/* FCM foreground alert banner */}
        {alert && (
          <div className="flex items-center gap-3 bg-indigo-600 px-5 py-2.5 text-white text-sm">
            <Bell size={15} className="flex-shrink-0" />
            <span className="flex-1">
              New activity from <strong>{alert.deviceName}</strong>
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
        {children}
      </div>
    </div>
  );
}
