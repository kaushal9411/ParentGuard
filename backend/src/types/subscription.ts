export interface SubscriptionFeatures {
  maxDevices:      number;
  location:        boolean;
  notifications:   boolean;
  callLogs:        boolean;
  smsLogs:         boolean;
  contacts:        boolean;
  appUsage:        boolean;
  gallery:         boolean;
  browsingHistory: boolean;
  geofencing:      boolean;
  appBlocking:     boolean;
  remoteCommands:  boolean;
  historyDays:     number;
}

export const FREE_FEATURES: SubscriptionFeatures = {
  maxDevices:      1,
  location:        true,
  notifications:   true,
  callLogs:        false,
  smsLogs:         false,
  contacts:        false,
  appUsage:        false,
  gallery:         false,
  browsingHistory: false,
  geofencing:      false,
  appBlocking:     false,
  remoteCommands:  false,
  historyDays:     7,
};

export function parseFeatures(json: string): SubscriptionFeatures {
  try {
    return { ...FREE_FEATURES, ...JSON.parse(json) };
  } catch {
    return FREE_FEATURES;
  }
}
