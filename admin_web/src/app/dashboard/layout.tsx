'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isLoggedIn } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import RouteLoader from '@/components/RouteLoader';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    if (!isLoggedIn()) router.replace('/auth/login');
  }, [router]);

  return (
    <div className="flex min-h-screen bg-surface">
      <RouteLoader />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">{children}</div>
    </div>
  );
}
