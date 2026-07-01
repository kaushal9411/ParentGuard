'use client';
import { useRouter } from 'next/navigation';
import {
  Camera, Mic, FolderOpen, Shield, Monitor, AppWindow, AlarmClock, Siren,
  ChevronRight, Radio,
} from 'lucide-react';
import Header from '@/components/Header';

const CARDS = [
  {
    key: 'sos',
    label: 'SOS & Emergency',
    desc: 'Ring, lock, alarm, locate and message the device instantly',
    icon: Siren,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    accent: 'from-red-500 to-rose-600',
  },
  {
    key: 'alarm',
    label: 'Alarms & Reminders',
    desc: 'Schedule alarms and reminders on the device remotely',
    icon: AlarmClock,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    accent: 'from-amber-500 to-orange-600',
  },
  {
    key: 'camera',
    label: 'Camera Capture',
    desc: 'Silently capture a photo from the front or back camera',
    icon: Camera,
    iconBg: 'bg-pink-100',
    iconColor: 'text-pink-600',
    accent: 'from-pink-500 to-rose-600',
  },
  {
    key: 'audio',
    label: 'Audio Recording',
    desc: 'Start / stop ambient microphone recording',
    icon: Mic,
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    accent: 'from-red-500 to-orange-600',
  },
  {
    key: 'screenshot',
    label: 'Screenshot',
    desc: 'Capture the current screen silently',
    icon: Monitor,
    iconBg: 'bg-cyan-100',
    iconColor: 'text-cyan-600',
    accent: 'from-cyan-500 to-teal-600',
  },
  {
    key: 'files',
    label: 'File Browsing',
    desc: 'List files and folders on device storage',
    icon: FolderOpen,
    iconBg: 'bg-yellow-100',
    iconColor: 'text-yellow-600',
    accent: 'from-yellow-500 to-amber-600',
  },
  {
    key: 'apps',
    label: 'Installed Apps',
    desc: 'List all user-installed apps on the device',
    icon: AppWindow,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    accent: 'from-emerald-500 to-green-600',
  },
  {
    key: 'quick',
    label: 'Quick Commands',
    desc: 'Lock device, block or unblock apps instantly',
    icon: Shield,
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    accent: 'from-indigo-500 to-violet-600',
  },
] as const;

export default function RemoteHubPage() {
  const router = useRouter();

  return (
    <>
      <Header title="Remote Access" subtitle="Control and reach your child's device remotely" />

      <main className="flex-1 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center">
            <Radio size={22} className="text-indigo-600" />
          </div>
          <p className="text-sm text-gray-500">
            Select a command category to perform actions on the device.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.key}
                onClick={() => router.push(`/dashboard/remote/${card.key}`)}
                className="group relative bg-white hover:shadow-lg border border-gray-100 rounded-2xl p-6 text-left transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r ${card.accent} opacity-0 group-hover:opacity-100 transition-opacity`} />
                <div className="flex items-start justify-between gap-4">
                  <div className={`w-12 h-12 ${card.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <Icon size={22} className={card.iconColor} />
                  </div>
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-gray-500 transition-colors mt-1" />
                </div>
                <div className="mt-4">
                  <h3 className="text-gray-800 font-bold text-base">{card.label}</h3>
                  <p className="text-gray-500 text-sm mt-1 leading-relaxed">{card.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </>
  );
}
