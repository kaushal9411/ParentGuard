'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Cpu, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import PageLoader from '@/components/PageLoader';
import DeviceControlPanel from '@/components/DeviceControlPanel';
import CommandHistoryList, { type HistoryCmd } from '@/components/CommandHistoryList';

interface DeviceInfo { deviceId: string; name: string; isOnline: boolean; }

const CONTROL_TYPES = ['reboot_device', 'set_volume', 'set_wifi', 'set_mobile_data'];

export default function AdminRemoteControlsPage() {
  const { userId, deviceId } = useParams<{ userId: string; deviceId: string }>();
  const router = useRouter();

  const [device,   setDevice]   = useState<DeviceInfo | null>(null);
  const [commands, setCommands] = useState<HistoryCmd[]>([]);
  const [loading,  setLoading]  = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    adminApi.userDetail(userId).then((r) => {
      setDevice(r.data.devices?.find((d: DeviceInfo) => d.deviceId === deviceId) ?? null);
    }).catch(() => {});
  }, [userId, deviceId]);

  const fetchCmds = useCallback(async () => {
    try {
      const r = await adminApi.deviceCommands(deviceId);
      setCommands((r.data as HistoryCmd[]).filter((c) => CONTROL_TYPES.includes(c.commandType)));
    } catch {}
  }, [deviceId]);

  useEffect(() => {
    setLoading(true);
    fetchCmds().finally(() => setLoading(false));
    pollRef.current = setInterval(fetchCmds, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchCmds]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-8 pt-8 pb-5 border-b border-gray-800">
        <button onClick={() => router.push(`/admin/users/${userId}/remote/${deviceId}`)}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors">
          <ArrowLeft size={15} /> Remote Access
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-500/20 rounded-xl flex items-center justify-center">
              <Cpu size={20} className="text-slate-300" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white">Device Controls</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-gray-400 text-sm">{device?.name ?? deviceId}</span>
                {device?.isOnline
                  ? <span className="flex items-center gap-1 text-green-400 text-xs"><Wifi size={11} /> Live</span>
                  : <span className="flex items-center gap-1 text-gray-500 text-xs"><WifiOff size={11} /> Offline</span>}
              </div>
            </div>
          </div>
          <button onClick={fetchCmds} className="text-gray-600 hover:text-gray-300 transition-colors">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        <DeviceControlPanel
          theme="dark"
          onIssue={async (type, payload) => {
            await adminApi.issueCommand(deviceId, type, payload);
            await fetchCmds();
          }}
        />

        <div className="space-y-2">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">
            Recent Control Commands
          </p>
          {loading ? <PageLoader theme="dark" /> : <CommandHistoryList commands={commands} theme="dark" />}
        </div>
      </div>
    </div>
  );
}
