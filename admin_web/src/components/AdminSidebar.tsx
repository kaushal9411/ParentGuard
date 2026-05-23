'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, Smartphone, CreditCard, Download,
  LogOut, ChevronRight, ChevronLeft, MessageSquare,
} from 'lucide-react';
import { clearAdminAuth, getAdminUser } from '@/lib/adminAuth';
import { adminApi } from '@/lib/adminApi';

const NAV = [
  { href: '/admin/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/devices',       icon: Smartphone,      label: 'Devices' },
  { href: '/admin/users',         icon: Users,           label: 'All Users' },
  { href: '/admin/subscriptions', icon: CreditCard,      label: 'Subscriptions' },
  { href: '/admin/inquiries',     icon: MessageSquare,   label: 'Inquiries' },
  { href: '/admin/app-release',   icon: Download,        label: 'App Release' },
];

function Tooltip({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="relative group/tip w-full">
      {children}
      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[200] pointer-events-none
        opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 delay-75">
        <div className="bg-gray-800 border border-gray-700 shadow-2xl text-white text-xs font-semibold
          px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-2">
          {label}
        </div>
        {/* Arrow */}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-700" />
      </div>
    </div>
  );
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [user,          setUser]    = useState<{ name: string; email: string } | null>(null);
  const [newInquiries,  setNewInq]  = useState(0);
  const [collapsed,     setCollapsed] = useState(false);
  const [mounted,       setMounted]   = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('admin_sidebar_collapsed');
    if (saved === 'true') setCollapsed(true);
    setMounted(true);
    setUser(getAdminUser<{ name: string; email: string }>());
    adminApi.getInquiries('new')
      .then((r) => setNewInq(Array.isArray(r.data) ? r.data.length : 0))
      .catch(() => {});
  }, []);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('admin_sidebar_collapsed', String(next));
  }

  function logout() {
    clearAdminAuth();
    router.push('/admin/login');
  }

  // Avoid flash of wrong width on first render
  const w = !mounted ? 'w-64' : collapsed ? 'w-16' : 'w-64';

  return (
    <aside className={`${w} min-h-screen bg-gray-950 flex flex-col border-r border-gray-800
      transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0`}>

      {/* ── Logo ─────────────────────────────────────────────────────────────── */}
      <div className={`flex items-center border-b border-gray-800 flex-shrink-0
        ${collapsed ? 'justify-center py-[22px] px-0' : 'gap-3 px-6 py-6'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="ParentGard" className="w-9 h-9 object-contain flex-shrink-0" />
        <div className={`overflow-hidden transition-all duration-300 ${collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
          <p className="text-white font-bold text-sm leading-none whitespace-nowrap">ParentGard</p>
          <p className="text-indigo-400 text-xs mt-0.5 font-semibold uppercase tracking-wide whitespace-nowrap">Admin Panel</p>
        </div>
      </div>

      {/* ── Admin user card ───────────────────────────────────────────────────── */}
      <div className={`border-b border-gray-800 flex-shrink-0 ${collapsed ? 'px-2 py-3' : 'px-4 py-4'}`}>
        {collapsed ? (
          <Tooltip label={user?.name ?? 'Admin'}>
            <div className="flex justify-center">
              <div className="w-8 h-8 bg-indigo-700 rounded-lg flex items-center justify-center
                text-white text-xs font-bold cursor-default">
                {user?.name?.charAt(0).toUpperCase() ?? 'A'}
              </div>
            </div>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-3 bg-gray-900 rounded-xl px-3 py-2.5">
            <div className="w-8 h-8 bg-indigo-700 rounded-lg flex items-center justify-center
              text-white text-xs font-bold flex-shrink-0">
              {user?.name?.charAt(0).toUpperCase() ?? 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{user?.name ?? 'Admin'}</p>
              <p className="text-gray-500 text-xs truncate">{user?.email ?? ''}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────────── */}
      <nav className={`flex-1 py-4 space-y-0.5 ${collapsed ? 'px-2' : 'px-3'}`}>
        {NAV.map(({ href, icon: Icon, label }) => {
          const active      = pathname.startsWith(href);
          const isInquiry   = label === 'Inquiries';
          const showBadge   = isInquiry && newInquiries > 0;

          const linkClass = `flex items-center rounded-xl font-medium transition-all duration-150 group
            ${collapsed ? 'justify-center px-0 py-2.5 w-full' : 'gap-3 px-3 py-2.5'}
            ${active ? 'bg-indigo-600/20 text-indigo-300' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`;

          const iconEl = (
            <div className="relative flex-shrink-0">
              <Icon size={18} className={active ? 'text-indigo-400' : 'text-gray-500 group-hover:text-gray-300'} />
              {collapsed && showBadge && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full ring-2 ring-gray-950" />
              )}
            </div>
          );

          if (collapsed) {
            return (
              <Tooltip key={href} label={showBadge ? `${label} (${newInquiries})` : label}>
                <Link href={href} className={linkClass}>{iconEl}</Link>
              </Tooltip>
            );
          }

          return (
            <Link key={href} href={href} className={linkClass}>
              {iconEl}
              <span className="flex-1 text-sm whitespace-nowrap">{label}</span>
              {showBadge && (
                <span className="bg-yellow-500 text-black text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none">
                  {newInquiries}
                </span>
              )}
              {active && <ChevronRight size={14} className="text-indigo-500" />}
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom: toggle + logout ───────────────────────────────────────────── */}
      <div className={`pb-6 flex-shrink-0 ${collapsed ? 'px-2' : 'px-3'}`}>
        <div className="border-t border-gray-800 pt-4 space-y-0.5">

          {/* Collapse / Expand toggle */}
          {collapsed ? (
            <Tooltip label="Expand Menu">
              <button onClick={toggleCollapse}
                className="w-full flex justify-center px-0 py-2.5 rounded-xl text-gray-500
                  hover:bg-gray-800 hover:text-white transition-all duration-150">
                <ChevronRight size={18} />
              </button>
            </Tooltip>
          ) : (
            <button onClick={toggleCollapse}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                text-gray-500 hover:bg-gray-800 hover:text-white transition-all duration-150">
              <ChevronLeft size={18} />
              <span className="whitespace-nowrap">Collapse Menu</span>
            </button>
          )}

          {/* Logout */}
          {collapsed ? (
            <Tooltip label="Sign Out">
              <button onClick={logout}
                className="w-full flex justify-center px-0 py-2.5 rounded-xl text-gray-500
                  hover:bg-red-900/30 hover:text-red-400 transition-all duration-150">
                <LogOut size={18} />
              </button>
            </Tooltip>
          ) : (
            <button onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                text-gray-500 hover:bg-red-900/30 hover:text-red-400 transition-all duration-150">
              <LogOut size={18} />
              <span className="whitespace-nowrap">Sign Out</span>
            </button>
          )}

        </div>
      </div>
    </aside>
  );
}
