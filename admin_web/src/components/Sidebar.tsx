'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Smartphone, MapPin, BarChart2, Bell, CreditCard, Download,
  LogOut, ChevronRight, ChevronLeft, ChevronDown, Image, Globe, Camera, Mic,
  FolderOpen, Zap, Map, Ban, MessageSquare, Monitor, AppWindow, Phone, Users,
  AlarmClock, Siren,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { clearAuth } from '@/lib/auth';
import { usePlan, type PlanFeatures } from '@/context/PlanContext';

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
  { href: '/dashboard/location',      icon: MapPin,          label: 'Location',         feature: 'location' },
  { href: '/dashboard/apps',          icon: BarChart2,       label: 'App Usage',        feature: 'appUsage' },
  { href: '/dashboard/notifications', icon: Bell,            label: 'Notifications',    feature: 'notifications' },
  { href: '/dashboard/calls',         icon: Phone,           label: 'Call Logs',        feature: 'callLogs' },
  { href: '/dashboard/contacts',      icon: Users,           label: 'Contacts',         feature: 'contacts' },
  { href: '/dashboard/sms',           icon: MessageSquare,   label: 'SMS Messages',     feature: 'smsLogs' },
  { href: '/dashboard/gallery',       icon: Image,           label: 'Gallery',          feature: 'gallery' },
  { href: '/dashboard/browsing',      icon: Globe,           label: 'Browsing History', feature: 'browsingHistory' },
  {
    href: '/dashboard/remote',
    icon: Camera,
    label: 'Remote Access',
    feature: 'remoteCommands',
    children: [
      { href: '/dashboard/remote/camera',     icon: Camera,     label: 'Camera',          feature: 'remoteCommands' },
      { href: '/dashboard/remote/audio',      icon: Mic,        label: 'Audio Recording', feature: 'remoteCommands' },
      { href: '/dashboard/remote/screenshot', icon: Monitor,    label: 'Screenshot',      feature: 'remoteCommands' },
      { href: '/dashboard/remote/files',      icon: FolderOpen, label: 'File Browsing',   feature: 'remoteCommands' },
      { href: '/dashboard/remote/apps',       icon: AppWindow,  label: 'Installed Apps',  feature: 'remoteCommands' },
      { href: '/dashboard/remote/sos',        icon: Siren,      label: 'SOS & Emergency', feature: 'remoteCommands' },
      { href: '/dashboard/remote/alarm',      icon: AlarmClock, label: 'Alarms & Reminders', feature: 'remoteCommands' },
      { href: '/dashboard/remote/quick',      icon: Zap,        label: 'Quick Commands',  feature: 'remoteCommands' },
    ],
  },
  { href: '/dashboard/geofencing',   icon: Map,             label: 'Geo Fencing',      feature: 'geofencing' },
  { href: '/dashboard/blocked-apps', icon: Ban,             label: 'Blocked Apps',     feature: 'appBlocking' },
  { href: '/dashboard/subscription', icon: CreditCard,      label: 'Subscription' },
  { href: '/dashboard/download',     icon: Download,        label: 'Download App' },
];

// ── Tooltip (shown only in collapsed mode) ────────────────────────────────────
function Tooltip({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="relative group/tip w-full">
      {children}
      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[200]
        pointer-events-none opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 delay-75">
        <div className="bg-gray-900 border border-white/10 shadow-2xl text-white text-xs font-semibold
          px-3 py-1.5 rounded-lg whitespace-nowrap">
          {label}
        </div>
        <div className="absolute right-full top-1/2 -translate-y-1/2
          border-4 border-transparent border-r-gray-900" />
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const plan     = usePlan();
  const [remoteOpen,  setRemoteOpen]  = useState(pathname.startsWith('/dashboard/remote'));
  const [collapsed,   setCollapsed]   = useState(false);
  const [mounted,     setMounted]     = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('user_sidebar_collapsed');
    if (saved === 'true') setCollapsed(true);
    setMounted(true);
  }, []);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('user_sidebar_collapsed', String(next));
  }

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

  const w = !mounted ? 'w-64' : collapsed ? 'w-16' : 'w-64';

  return (
    <aside className={`${w} min-h-screen bg-sidebar flex flex-col
      transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0`}>

      {/* ── Logo ──────────────────────────────────────────────────────────────── */}
      <div className={`flex items-center border-b border-white/10 flex-shrink-0
        ${collapsed ? 'justify-center py-[22px] px-0' : 'gap-3 px-6 py-6'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="ParentGard" className="w-10 h-10 object-contain flex-shrink-0" />
        <div className={`overflow-hidden transition-all duration-300 ${collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
          <p className="text-white font-bold text-base leading-none whitespace-nowrap">ParentGard</p>
          <p className="text-blue-300 text-xs mt-0.5 whitespace-nowrap">Parent Portal</p>
        </div>
      </div>

      {/* ── Plan badge (hidden when collapsed) ───────────────────────────────── */}
      {plan.planName && !collapsed && (
        <div className="mx-3 mt-3 px-3 py-2 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-300 font-medium whitespace-nowrap">{plan.planName} Plan</span>
            {plan.status === 'expired'
              ? <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded-full">Expired</span>
              : <span className="text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded-full">Active</span>}
          </div>
        </div>
      )}

      {/* ── Nav ───────────────────────────────────────────────────────────────── */}
      <nav className={`flex-1 py-4 space-y-0.5 ${collapsed ? 'px-2' : 'px-3'}`}>
        {!collapsed && (
          <p className="text-blue-400 text-xs font-semibold uppercase tracking-wider px-3 mb-3">
            Monitoring
          </p>
        )}

        {NAV.map(({ href, icon: Icon, label, feature, children }) => {
          if (!hasAccess(feature)) return null;

          // ── Expandable group (Remote Access) ──────────────────────────────
          if (children) {
            const groupActive = pathname.startsWith(href);

            if (collapsed) {
              return (
                <Tooltip key={href} label={label}>
                  <Link href={href}
                    className={`flex justify-center px-0 py-2.5 rounded-xl transition-all duration-150 group
                      ${groupActive ? 'bg-primary-light/20 text-white' : 'text-blue-200 hover:bg-white/10 hover:text-white'}`}>
                    <Icon size={18} className={groupActive ? 'text-primary-light' : 'text-blue-300 group-hover:text-white'} />
                  </Link>
                </Tooltip>
              );
            }

            return (
              <div key={href}>
                <div
                  className={`w-full flex items-center gap-3 pl-3 pr-2 py-2.5 rounded-xl text-sm font-medium
                    transition-all duration-150 group
                    ${groupActive ? 'bg-primary-light/20 text-white' : 'text-blue-200 hover:bg-white/10 hover:text-white'}`}>
                  {/* Label opens the Remote Access hub (cards) */}
                  <Link href={href} onClick={() => setRemoteOpen(true)}
                    className="flex items-center gap-3 flex-1 min-w-0">
                    <Icon size={18} className={groupActive ? 'text-primary-light' : 'text-blue-300 group-hover:text-white'} />
                    <span className="flex-1 text-left whitespace-nowrap">{label}</span>
                  </Link>
                  {/* Chevron toggles the submenu */}
                  <button onClick={() => setRemoteOpen((o) => !o)} className="p-0.5" aria-label="Toggle submenu">
                    <ChevronDown size={14} className={`text-blue-300 transition-transform duration-200 ${remoteOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {remoteOpen && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                    {children.map((child) => {
                      if (!hasAccess(child.feature)) return null;
                      const childActive = isActive(child.href);
                      return (
                        <Link key={child.href} href={child.href}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium
                            transition-all duration-150 group
                            ${childActive ? 'bg-primary-light/20 text-white' : 'text-blue-200/80 hover:bg-white/10 hover:text-white'}`}>
                          <child.icon size={15} className={childActive ? 'text-primary-light' : 'text-blue-300/70 group-hover:text-white'} />
                          <span className="flex-1 whitespace-nowrap">{child.label}</span>
                          {childActive && <ChevronRight size={12} className="text-blue-300" />}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // ── Regular nav link ──────────────────────────────────────────────
          const active = isActive(href);

          if (collapsed) {
            return (
              <Tooltip key={href} label={label}>
                <Link href={href}
                  className={`flex justify-center px-0 py-2.5 rounded-xl transition-all duration-150 group
                    ${active ? 'bg-primary-light/20 text-white' : 'text-blue-200 hover:bg-white/10 hover:text-white'}`}>
                  <Icon size={18} className={active ? 'text-primary-light' : 'text-blue-300 group-hover:text-white'} />
                </Link>
              </Tooltip>
            );
          }

          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-150 group
                ${active ? 'bg-primary-light/20 text-white' : 'text-blue-200 hover:bg-white/10 hover:text-white'}`}>
              <Icon size={18} className={active ? 'text-primary-light' : 'text-blue-300 group-hover:text-white'} />
              <span className="flex-1 whitespace-nowrap">{label}</span>
              {active && <ChevronRight size={14} className="text-blue-300" />}
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom: collapse toggle + logout ─────────────────────────────────── */}
      <div className={`pb-6 flex-shrink-0 ${collapsed ? 'px-2' : 'px-3'}`}>
        <div className="border-t border-white/10 pt-4 space-y-0.5">

          {/* Toggle */}
          {collapsed ? (
            <Tooltip label="Expand Menu">
              <button onClick={toggleCollapse}
                className="w-full flex justify-center px-0 py-2.5 rounded-xl text-blue-300
                  hover:bg-white/10 hover:text-white transition-all duration-150">
                <ChevronRight size={18} />
              </button>
            </Tooltip>
          ) : (
            <button onClick={toggleCollapse}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                text-blue-200 hover:bg-white/10 hover:text-white transition-all duration-150">
              <ChevronLeft size={18} />
              <span className="whitespace-nowrap">Collapse Menu</span>
            </button>
          )}

          {/* Logout */}
          {collapsed ? (
            <Tooltip label="Sign Out">
              <button onClick={logout}
                className="w-full flex justify-center px-0 py-2.5 rounded-xl text-blue-200
                  hover:bg-red-500/20 hover:text-red-300 transition-all duration-150">
                <LogOut size={18} />
              </button>
            </Tooltip>
          ) : (
            <button onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                text-blue-200 hover:bg-red-500/20 hover:text-red-300 transition-all duration-150">
              <LogOut size={18} />
              <span className="whitespace-nowrap">Sign Out</span>
            </button>
          )}

        </div>
      </div>
    </aside>
  );
}
