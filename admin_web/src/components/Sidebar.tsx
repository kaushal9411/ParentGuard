'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Shield, LayoutDashboard, Smartphone, MapPin,
  BarChart2, Bell, LogOut, ChevronRight,
} from 'lucide-react';
import { clearAuth } from '@/lib/auth';

const NAV = [
  { href: '/dashboard',              icon: LayoutDashboard, label: 'Overview' },
  { href: '/dashboard/devices',      icon: Smartphone,      label: 'Devices' },
  { href: '/dashboard/location',     icon: MapPin,          label: 'Location' },
  { href: '/dashboard/apps',         icon: BarChart2,       label: 'App Usage' },
  { href: '/dashboard/notifications',icon: Bell,            label: 'Notifications' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  function logout() {
    clearAuth();
    router.push('/auth/login');
  }

  return (
    <aside className="w-64 min-h-screen bg-sidebar flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
        <div className="w-9 h-9 bg-primary-light rounded-xl flex items-center justify-center flex-shrink-0">
          <Shield size={20} className="text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-base leading-none">ParentGuard</p>
          <p className="text-blue-300 text-xs mt-0.5">Admin Panel</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="text-blue-400 text-xs font-semibold uppercase tracking-wider px-3 mb-3">
          Monitoring
        </p>
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group
                ${active
                  ? 'bg-primary-light/20 text-white'
                  : 'text-blue-200 hover:bg-white/10 hover:text-white'}`}>
              <Icon size={18} className={active ? 'text-primary-light' : 'text-blue-300 group-hover:text-white'} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} className="text-blue-300" />}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-6">
        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-blue-200 hover:bg-red-500/20 hover:text-red-300 transition-all duration-150">
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
