'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Shield, LayoutDashboard, Smartphone, MapPin,
  BarChart2, Bell, CreditCard, Download, LogOut,
  ChevronRight, Image, Globe, Camera, Mic,
  FolderOpen, Zap, Map, Ban, ChevronDown, MessageSquare,
  Monitor, AppWindow, Phone, Users,
} from 'lucide-react';
import { useState } from 'react';
import { clearAuth } from '@/lib/auth';
import { usePlan, type PlanFeatures } from '@/context/PlanContext';

// ── Feature key per nav item (undefined = always visible) ────────────────────
type FeatureKey = keyof PlanFeatures | undefined;

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  feature?: FeatureKey;
  children?: NavItem[];
}

const NAV: NavItem[] = [
  { href: '/dashboard',               icon: LayoutDashboard, label: 'Overview' },
  { href: '/dashboard/devices',       icon: Smartphone,      label: 'Devices' },
  { href: '/dashboard/location',      icon: MapPin,          label: 'Location',        feature: 'location' },
  { href: '/dashboard/apps',          icon: BarChart2,       label: 'App Usage',       feature: 'appUsage' },
  { href: '/dashboard/notifications', icon: Bell,            label: 'Notifications',   feature: 'notifications' },
  { href: '/dashboard/calls',         icon: Phone,           label: 'Call Logs',       feature: 'callLogs' },
  { href: '/dashboard/contacts',      icon: Users,           label: 'Contacts',        feature: 'contacts' },
  { href: '/dashboard/sms',           icon: MessageSquare,   label: 'SMS Messages',    feature: 'smsLogs' },
  { href: '/dashboard/gallery',       icon: Image,           label: 'Gallery',         feature: 'gallery' },
  { href: '/dashboard/browsing',      icon: Globe,           label: 'Browsing History',feature: 'browsingHistory' },
  {
    href: '/dashboard/remote',
    icon: Camera,
    label: 'Remote Access',
    feature: 'remoteCommands',
    children: [
      { href: '/dashboard/remote/camera',     icon: Camera,     label: 'Camera',         feature: 'remoteCommands' },
      { href: '/dashboard/remote/audio',      icon: Mic,        label: 'Audio Recording',feature: 'remoteCommands' },
      { href: '/dashboard/remote/screenshot', icon: Monitor,    label: 'Screenshot',     feature: 'remoteCommands' },
      { href: '/dashboard/remote/files',      icon: FolderOpen, label: 'File Browsing',  feature: 'remoteCommands' },
      { href: '/dashboard/remote/apps',       icon: AppWindow,  label: 'Installed Apps', feature: 'remoteCommands' },
      { href: '/dashboard/remote/quick',      icon: Zap,        label: 'Quick Commands', feature: 'remoteCommands' },
    ],
  },
  { href: '/dashboard/geofencing',    icon: Map,             label: 'Geo Fencing',     feature: 'geofencing' },
  { href: '/dashboard/blocked-apps',  icon: Ban,             label: 'Blocked Apps',    feature: 'appBlocking' },
  { href: '/dashboard/subscription',  icon: CreditCard,      label: 'Subscription' },
  { href: '/dashboard/download',      icon: Download,        label: 'Download App' },
];

// ── Sidebar component ─────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const plan     = usePlan();
  const [remoteOpen, setRemoteOpen] = useState(pathname.startsWith('/dashboard/remote'));

  function logout() { clearAuth(); router.push('/auth/login'); }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  function hasAccess(feature: FeatureKey): boolean {
    if (!feature) return true;
    const val = plan[feature];
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val > 0;
    return true;
  }

  function NavLink({ href, icon: Icon, label, feature }: NavItem) {
    if (!hasAccess(feature)) return null;
    const active = isActive(href);
    return (
      <Link href={href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group
          ${active
            ? 'bg-primary-light/20 text-white'
            : 'text-blue-200 hover:bg-white/10 hover:text-white'}`}>
        <Icon size={18} className={active ? 'text-primary-light' : 'text-blue-300 group-hover:text-white'} />
        <span className="flex-1">{label}</span>
        {active && <ChevronRight size={14} className="text-blue-300" />}
      </Link>
    );
  }

  return (
    <aside className="w-64 min-h-screen bg-sidebar flex flex-col overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10 flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="ParentGard" className="w-10 h-10 object-contain flex-shrink-0" />
        <div>
          <p className="text-white font-bold text-base leading-none">ParentGard</p>
          <p className="text-blue-300 text-xs mt-0.5">Parent Portal</p>
        </div>
      </div>

      {/* Plan badge */}
      {plan.planName && (
        <div className="mx-3 mt-3 px-3 py-2 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-300 font-medium">{plan.planName} Plan</span>
            {plan.status === 'expired' ? (
              <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded-full">Expired</span>
            ) : (
              <span className="text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded-full">Active</span>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-blue-400 text-xs font-semibold uppercase tracking-wider px-3 mb-3">
          Monitoring
        </p>

        {NAV.map(({ href, icon: Icon, label, feature, children }) => {
          if (children) {
            // Expandable group (Remote Access)
            const groupAllowed = hasAccess(feature);
            const groupActive  = pathname.startsWith(href);

            if (!groupAllowed) return null;

            return (
              <div key={href}>
                <button onClick={() => setRemoteOpen((o) => !o)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group
                    ${groupActive ? 'bg-primary-light/20 text-white' : 'text-blue-200 hover:bg-white/10 hover:text-white'}`}>
                  <Icon size={18} className={groupActive ? 'text-primary-light' : 'text-blue-300 group-hover:text-white'} />
                  <span className="flex-1 text-left">{label}</span>
                  <ChevronDown size={14} className={`text-blue-300 transition-transform duration-200 ${remoteOpen ? 'rotate-180' : ''}`} />
                </button>

                {remoteOpen && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                    {children.map((child) => {
                      const childActive  = isActive(child.href);
                      return (
                        <Link key={child.href} href={child.href}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 group
                            ${childActive ? 'bg-primary-light/20 text-white' : 'text-blue-200/80 hover:bg-white/10 hover:text-white'}`}>
                          <child.icon size={15} className={childActive ? 'text-primary-light' : 'text-blue-300/70 group-hover:text-white'} />
                          <span className="flex-1">{child.label}</span>
                          {childActive && <ChevronRight size={12} className="text-blue-300" />}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return <NavLink key={href} href={href} icon={Icon} label={label} feature={feature} />;
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
