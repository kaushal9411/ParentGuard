'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, AlarmClock, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import PageLoader from '@/components/PageLoader';
import AlarmReminderPanel from '@/components/AlarmReminderPanel';
import AlarmReminderList, { type AlarmCmd } from '@/components/AlarmReminderList';

interface DeviceInfo { deviceId: string; name: string; isOnline: boolean; }

export default function AdminRemoteAlarmPage() {
  const { userId, deviceId } = useParams<{ userId: string; deviceId: string }>();
  const router = useRouter();

  const [device,   setDevice]   = useState<DeviceInfo | null>(null);
  const [commands, setCommands] = useState<AlarmCmd[]>([]);
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
      setCommands((r.data as AlarmCmd[]).filter(
        (c) => c.commandType === 'set_alarm' || c.commandType === 'set_reminder'));
    } catch {}
  }, [deviceId]);

  useEffect(() => {
    setLoading(true);
    fetchCmds().finally(() => setLoading(false));
    pollRef.current = setInterval(fetchCmds, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchCmds]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-8 pt-8 pb-5 border-b border-gray-800">
        <button onClick={() => router.push(`/admin/users/${userId}/remote/${deviceId}`)}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors">
          <ArrowLeft size={15} /> Remote Access
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <AlarmClock size={20} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white">Alarms &amp; Reminders</h1>
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
        {/* Add form */}
        <AlarmReminderPanel
          theme="dark"
          onIssue={async (type, payload) => {
            await adminApi.issueCommand(deviceId, type, payload);
            await fetchCmds();
          }}
        />

        {/* Scheduled list */}
        <div className="space-y-2">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">
            Scheduled Alarms &amp; Reminders
          </p>
          {loading ? <PageLoader theme="dark" /> : <AlarmReminderList commands={commands} theme="dark" />}
        </div>
      </div>
    </div>
  );
}
