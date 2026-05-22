'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldCheck, LayoutDashboard, Users, Smartphone, CreditCard, Download, LogOut, ChevronRight, MessageSquare } from 'lucide-react';
import { clearAdminAuth, getAdminUser } from '@/lib/adminAuth';
import { adminApi } from '@/lib/adminApi';

const NAV = [
  { href: '/admin/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/devices', icon: Smartphone, label: 'Devices' },
  { href: '/admin/users',        icon: Users,           label: 'All Users' },
  { href: '/admin/subscriptions',icon: CreditCard,      label: 'Subscriptions' },
  { href: '/admin/inquiries',    icon: MessageSquare,   label: 'Inquiries' },
  { href: '/admin/app-release',  icon: Download,        label: 'App Release' },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [user, setUser]           = useState<{ name: string; email: string } | null>(null);
  const [newInquiries, setNewInq] = useState(0);

  useEffect(() => {
    setUser(getAdminUser<{ name: string; email: string }>());
    // Load unread inquiry count
    adminApi.getInquiries('new')
      .then((r) => setNewInq(Array.isArray(r.data) ? r.data.length : 0))
      .catch(() => {});
  }, []);

  function logout() {
    clearAdminAuth();
    router.push('/admin/login');
  }

  return (
    <aside className="w-64 min-h-screen bg-gray-950 flex flex-col border-r border-gray-800">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-gray-800">
        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <ShieldCheck size={20} className="text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-none">ParentGuard</p>
          <p className="text-indigo-400 text-xs mt-0.5 font-semibold uppercase tracking-wide">Admin Panel</p>
        </div>
      </div>

      {/* Admin user */}
      <div className="px-4 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3 bg-gray-900 rounded-xl px-3 py-2.5">
          <div className="w-8 h-8 bg-indigo-700 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.name?.charAt(0) ?? 'A'}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold truncate">{user?.name ?? 'Admin'}</p>
            <p className="text-gray-500 text-xs truncate">{user?.email ?? ''}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group
                ${active
                  ? 'bg-indigo-600/20 text-indigo-300'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
              <Icon size={18} className={active ? 'text-indigo-400' : 'text-gray-500 group-hover:text-gray-300'} />
              <span className="flex-1">{label}</span>
              {label === 'Inquiries' && newInquiries > 0 && (
                <span className="bg-yellow-500 text-black text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none">
                  {newInquiries}
                </span>
              )}
              {active && <ChevronRight size={14} className="text-indigo-500" />}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-6">
        <div className="border-t border-gray-800 pt-4">
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500
                       hover:bg-red-900/30 hover:text-red-400 transition-all duration-150">
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
