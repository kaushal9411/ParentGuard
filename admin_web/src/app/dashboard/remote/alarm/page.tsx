'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import Header from '@/components/Header';
import { devicesApi, userCommandsApi } from '@/lib/api';
import type { Device } from '@/types';
import PageLoader from '@/components/PageLoader';
import AlarmReminderPanel from '@/components/AlarmReminderPanel';
import AlarmReminderList, { type AlarmCmd } from '@/components/AlarmReminderList';

export default function RemoteAlarmPage() {
  const [devices,  setDevices]  = useState<Device[]>([]);
  const [selected, setSelected] = useState('');
  const [commands, setCommands] = useState<AlarmCmd[]>([]);
  const [loading,  setLoading]  = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    devicesApi.list().then((r) => {
      const devs: Device[] = r.data;
      setDevices(devs);
      const first = devs.find((d) => d.role === 'child');
      if (first) setSelected(first.deviceId);
    });
  }, []);

  const fetchCommands = useCallback(async () => {
    if (!selected) return;
    try {
      const r = await userCommandsApi.list(selected);
      setCommands(
        (r.data as AlarmCmd[]).filter(
          (c) => c.commandType === 'set_alarm' || c.commandType === 'set_reminder',
        ),
      );
    } catch {}
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetchCommands().finally(() => setLoading(false));
    pollRef.current = setInterval(fetchCommands, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected, fetchCommands]);

  const device = devices.find((d) => d.deviceId === selected);

  return (
    <>
      <Header title="Alarms & Reminders" subtitle="Remotely schedule alarms and reminders on your child's device" />

      <main className="flex-1 p-8 space-y-6">
        {/* Device selector */}
        <div className="card py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700">Device:</label>
              <select value={selected} onChange={(e) => setSelected(e.target.value)} className="input max-w-xs">
                {devices.filter((d) => d.role === 'child').map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.name}</option>
                ))}
              </select>
            </div>
            {device && (
              <div className={`flex items-center gap-1.5 text-sm ${device.isOnline ? 'text-green-600' : 'text-gray-400'}`}>
                {device.isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                {device.isOnline ? 'Online' : 'Offline'}
              </div>
            )}
            <button onClick={fetchCommands} className="ml-auto text-gray-400 hover:text-primary">
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Add form */}
        <AlarmReminderPanel
          disabled={!selected}
          onIssue={async (type, payload) => {
            if (!selected) return;
            await userCommandsApi.issue(selected, type, payload);
            await fetchCommands();
          }}
        />

        {/* Scheduled list */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-700 text-sm">Scheduled Alarms &amp; Reminders</h3>
          {loading ? <PageLoader /> : <AlarmReminderList commands={commands} />}
        </div>
      </main>
    </>
  );
}
