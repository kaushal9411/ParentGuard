'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Shield, LayoutDashboard, Smartphone, MapPin,
  BarChart2, Bell, CreditCard, Download, LogOut,
  ChevronRight, Image, Globe, Camera, Mic,
  FolderOpen, Zap, Map, Ban, ChevronDown, MessageSquare,
} from 'lucide-react';
import { useState } from 'react';
import { clearAuth } from '@/lib/auth';

// ── Nav structure ─────────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  children?: NavItem[];
}

const NAV: NavItem[] = [
  { href: '/dashboard',               icon: LayoutDashboard, label: 'Overview' },
  { href: '/dashboard/devices',       icon: Smartphone,      label: 'Devices' },
  { href: '/dashboard/location',      icon: MapPin,          label: 'Location' },
  { href: '/dashboard/apps',          icon: BarChart2,       label: 'App Usage' },
  { href: '/dashboard/notifications', icon: Bell,            label: 'Notifications' },
  { href: '/dashboard/sms',           icon: MessageSquare,   label: 'SMS Messages' },
  { href: '/dashboard/gallery',       icon: Image,           label: 'Gallery' },
  { href: '/dashboard/browsing',      icon: Globe,           label: 'Browsing History' },
  {
    href: '/dashboard/remote',
    icon: Camera,
    label: 'Remote Access',
    children: [
      { href: '/dashboard/remote/camera', icon: Camera,     label: 'Camera' },
      { href: '/dashboard/remote/audio',  icon: Mic,        label: 'Audio Recording' },
      { href: '/dashboard/remote/files',  icon: FolderOpen, label: 'File Browsing' },
      { href: '/dashboard/remote/quick',  icon: Zap,        label: 'Quick Commands' },
    ],
  },
  { href: '/dashboard/geofencing',    icon: Map,             label: 'Geo Fencing' },
  { href: '/dashboard/blocked-apps',  icon: Ban,             label: 'Blocked Apps' },
  { href: '/dashboard/subscription',  icon: CreditCard,      label: 'Subscription' },
  { href: '/dashboard/download',      icon: Download,        label: 'Download App' },
];

// ── Sidebar component ─────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [remoteOpen, setRemoteOpen] = useState(pathname.startsWith('/dashboard/remote'));

  function logout() {
    clearAuth();
    router.push('/auth/login');
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-64 min-h-screen bg-sidebar flex flex-col overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10 flex-shrink-0">
        <div className="w-9 h-9 bg-primary-light rounded-xl flex items-center justify-center flex-shrink-0">
          <Shield size={20} className="text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-base leading-none">ParentGuard</p>
          <p className="text-blue-300 text-xs mt-0.5">Parent Portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-blue-400 text-xs font-semibold uppercase tracking-wider px-3 mb-3">
          Monitoring
        </p>

        {NAV.map(({ href, icon: Icon, label, children }) => {
          if (children) {
            // Expandable group (Remote Access)
            const groupActive = pathname.startsWith(href);
            return (
              <div key={href}>
                <button
                  onClick={() => setRemoteOpen((o) => !o)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group
                    ${groupActive
                      ? 'bg-primary-light/20 text-white'
                      : 'text-blue-200 hover:bg-white/10 hover:text-white'}`}>
                  <Icon size={18} className={groupActive ? 'text-primary-light' : 'text-blue-300 group-hover:text-white'} />
                  <span className="flex-1 text-left">{label}</span>
                  <ChevronDown size={14} className={`text-blue-300 transition-transform duration-200 ${remoteOpen ? 'rotate-180' : ''}`} />
                </button>

                {remoteOpen && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                    {children.map(({ href: childHref, icon: ChildIcon, label: childLabel }) => {
                      const active = isActive(childHref);
                      return (
                        <Link key={childHref} href={childHref}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 group
                            ${active
                              ? 'bg-primary-light/20 text-white'
                              : 'text-blue-200/80 hover:bg-white/10 hover:text-white'}`}>
                          <ChildIcon size={15} className={active ? 'text-primary-light' : 'text-blue-300/70 group-hover:text-white'} />
                          <span className="flex-1">{childLabel}</span>
                          {active && <ChevronRight size={12} className="text-blue-300" />}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const active = isActive(href);
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
      <div className="px-3 pb-6 flex-shrink-0">
        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-blue-200 hover:bg-red-500/20 hover:text-red-300 transition-all duration-150">
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
