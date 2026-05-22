'use client';
import { useEffect, useState } from 'react';
import {
  Users, Smartphone, Wifi, MapPin, Bell, BarChart2,
  UserPlus, Activity, MessageSquare, Phone, Image, Globe, Contact,
} from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import PageLoader from '@/components/PageLoader';

interface Stats {
  totalUsers: number; totalDevices: number; onlineDevices: number;
  totalLocations: number; totalNotifications: number; totalUsageLogs: number;
  totalCallLogs: number; totalSmsLogs: number;
  totalContacts: number; totalGalleryItems: number; totalBrowsing: number;
  newUsersToday: number; newDevicesToday: number; syncedToday: number;
}

function StatCard({ label, value, sub, icon, accent }: {
  label: string; value: number; sub?: string;
  icon: React.ReactNode; accent: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 ${accent} rounded-xl flex items-center justify-center`}>
          {icon}
        </div>
        {sub && Number(sub) > 0 && (
          <span className="text-xs font-semibold text-green-400 bg-green-400/10 px-2 py-1 rounded-full">
            +{sub} today
          </span>
        )}
      </div>
      <p className="text-3xl font-extrabold text-white">{value.toLocaleString()}</p>
      <p className="text-gray-500 text-sm mt-1">{label}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.stats()
      .then((r) => setStats(r.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 p-8 space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-2xl font-extrabold text-white">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {loading ? (
        <PageLoader theme="dark" />
      ) : stats ? (
        <>
          {/* Platform Overview */}
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Platform Overview</h2>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard label="Total Users" value={stats.totalUsers} sub={String(stats.newUsersToday)}
                icon={<Users size={20} className="text-indigo-300" />} accent="bg-indigo-600/20" />
              <StatCard label="Child Devices" value={stats.totalDevices} sub={String(stats.newDevicesToday)}
                icon={<Smartphone size={20} className="text-blue-300" />} accent="bg-blue-600/20" />
              <StatCard label="Online Now" value={stats.onlineDevices}
                icon={<Wifi size={20} className="text-green-300" />} accent="bg-green-600/20" />
              <StatCard label="Events Synced Today" value={stats.syncedToday ?? 0}
                icon={<Activity size={20} className="text-purple-300" />} accent="bg-purple-600/20" />
            </div>
          </div>

          {/* Collected Data */}
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Collected Data</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-4">
              <StatCard label="Location Logs" value={stats.totalLocations}
                icon={<MapPin size={20} className="text-orange-300" />} accent="bg-orange-600/20" />
              <StatCard label="Notifications" value={stats.totalNotifications}
                icon={<Bell size={20} className="text-red-300" />} accent="bg-red-600/20" />
              <StatCard label="App Usage" value={stats.totalUsageLogs}
                icon={<BarChart2 size={20} className="text-cyan-300" />} accent="bg-cyan-600/20" />
              <StatCard label="Call Logs" value={stats.totalCallLogs ?? 0}
                icon={<Phone size={20} className="text-green-300" />} accent="bg-green-600/20" />
              <StatCard label="SMS Messages" value={stats.totalSmsLogs ?? 0}
                icon={<MessageSquare size={20} className="text-violet-300" />} accent="bg-violet-600/20" />
              <StatCard label="Contacts" value={stats.totalContacts ?? 0}
                icon={<Contact size={20} className="text-teal-300" />} accent="bg-teal-600/20" />
              <StatCard label="Gallery Items" value={stats.totalGalleryItems ?? 0}
                icon={<Image size={20} className="text-pink-300" />} accent="bg-pink-600/20" />
              <StatCard label="Browsing History" value={stats.totalBrowsing ?? 0}
                icon={<Globe size={20} className="text-yellow-300" />} accent="bg-yellow-600/20" />
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-white font-bold mb-4">Quick Actions</h2>
            <div className="flex flex-wrap gap-3">
              <a href="/admin/users"
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
                <Users size={16} /> View All Users
              </a>
              <a href="/auth/register"
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
                <UserPlus size={16} /> Add New Parent
              </a>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
