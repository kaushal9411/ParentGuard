'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import api from '@/lib/api';

export interface PlanFeatures {
  location: boolean; notifications: boolean; callLogs: boolean; smsLogs: boolean;
  contacts: boolean; appUsage: boolean; gallery: boolean; browsingHistory: boolean;
  geofencing: boolean; appBlocking: boolean; remoteCommands: boolean;
  maxDevices: number; historyDays: number;
  planName?: string; status?: string;
}

const FREE: PlanFeatures = {
  location: true, notifications: true, callLogs: false, smsLogs: false,
  contacts: false, appUsage: false, gallery: false, browsingHistory: false,
  geofencing: false, appBlocking: false, remoteCommands: false,
  maxDevices: 1, historyDays: 7,
};

const PlanContext = createContext<PlanFeatures>(FREE);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [features, setFeatures] = useState<PlanFeatures>(FREE);

  useEffect(() => {
    api.get('/api/subscription/my')
      .then((r) => {
        const data = r.data;
        setFeatures({
          ...(data.features ?? FREE),
          planName: data.plan?.name,
          status:   data.status,
        });
      })
      .catch(() => setFeatures(FREE));
  }, []);

  return <PlanContext.Provider value={features}>{children}</PlanContext.Provider>;
}

export function usePlan() { return useContext(PlanContext); }
