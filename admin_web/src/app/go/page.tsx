'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isLoggedIn } from '@/lib/auth';

export default function Go() {
  const router = useRouter();
  useEffect(() => {
    router.replace(isLoggedIn() ? '/dashboard' : '/auth/login');
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
