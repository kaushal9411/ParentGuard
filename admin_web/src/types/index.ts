export interface User {
  userId: string;
  name: string;
  email: string;
  role: 'parent' | 'child';
  devices: Device[];
}

export interface Device {
  id: string;
  deviceId: string;
  name: string;
  role: 'child' | 'parent';
  isOnline: boolean;
  lastSeen: string | null;
  registeredAt: string;
  setupCode?: string;
}

export interface LocationLog {
  id: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  speed: number | null;
  address: string | null;
  capturedAt: string;
  syncedAt: string;
}

export interface AppUsageLog {
  id: string;
  deviceId: string;
  packageName: string;
  appName: string;
  usageDurationMs: string;
  lastUsed: string;
  capturedAt: string;
  category: string | null;
}

export interface NotificationLog {
  id: string;
  deviceId: string;
  packageName: string;
  appName: string;
  title: string | null;
  body: string | null;
  postedAt: string;
  category: string | null;
}

export interface DeviceStatusLog {
  batteryLevel: number;
  isCharging: boolean;
  networkType: string;
  isConnected: boolean;
  capturedAt: string;
}

export interface AuthResponse {
  token: string;
  userId: string;
  role: string;
  name: string;
  email: string;
}
