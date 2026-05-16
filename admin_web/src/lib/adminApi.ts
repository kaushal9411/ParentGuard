import axios from 'axios';
import { getAdminToken, clearAdminAuth } from './adminAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

const adminAxios = axios.create({ baseURL: API_URL });

adminAxios.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

adminAxios.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      clearAdminAuth();
      window.location.href = '/admin/login';
    }
    return Promise.reject(err);
  },
);

export const adminApi = {
  login: (email: string, password: string) =>
    adminAxios.post('/api/admin/login', { email, password }),

  stats: () => adminAxios.get('/api/admin/stats'),

  users: (params?: { search?: string; page?: number }) =>
    adminAxios.get('/api/admin/users', { params }),

  userDetail: (userId: string, deviceId?: string) =>
    adminAxios.get(`/api/admin/users/${userId}`, { params: deviceId ? { deviceId } : {} }),

  userDevices: (userId: string) =>
    adminAxios.get(`/api/admin/users/${userId}`).then((r) => r.data.devices ?? []),

  userLocations: (userId: string, limit = 200, deviceId?: string) =>
    adminAxios.get(`/api/admin/users/${userId}/locations`, { params: { limit, ...(deviceId ? { deviceId } : {}) } }),

  userCalls: (userId: string, deviceId?: string) =>
    adminAxios.get(`/api/admin/users/${userId}/calls`, { params: deviceId ? { deviceId } : {} }),

  userGallery: (userId: string, type?: 'image' | 'video', deviceId?: string) =>
    adminAxios.get(`/api/admin/users/${userId}/gallery`, { params: { ...(type ? { type } : {}), ...(deviceId ? { deviceId } : {}) } }),

  deleteUser: (userId: string) =>
    adminAxios.delete(`/api/admin/users/${userId}`),

  // ── Remote commands ──────────────────────────────────────────────────────
  issueCommand: (deviceId: string, commandType: string, payload?: Record<string, unknown>) =>
    adminAxios.post(`/api/admin/devices/${deviceId}/commands`, { commandType, payload }),

  deviceCommands: (deviceId: string) =>
    adminAxios.get(`/api/admin/devices/${deviceId}/commands`),

  cancelCommand: (commandId: string) =>
    adminAxios.delete(`/api/admin/commands/${commandId}`),

  // ── Geofences ────────────────────────────────────────────────────────────
  createGeofence: (deviceId: string, data: { name: string; latitude: number; longitude: number; radiusM: number }) =>
    adminAxios.post(`/api/admin/devices/${deviceId}/geofences`, data),

  deviceGeofences: (deviceId: string) =>
    adminAxios.get(`/api/admin/devices/${deviceId}/geofences`),

  toggleGeofence: (geofenceId: string, isActive: boolean) =>
    adminAxios.patch(`/api/admin/geofences/${geofenceId}`, { isActive }),

  deleteGeofence: (geofenceId: string) =>
    adminAxios.delete(`/api/admin/geofences/${geofenceId}`),

  // ── App block rules ──────────────────────────────────────────────────────
  setAppBlock: (deviceId: string, packageName: string, appName: string, isBlocked: boolean) =>
    adminAxios.post(`/api/admin/devices/${deviceId}/app-blocks`, { packageName, appName, isBlocked }),

  deviceAppBlocks: (deviceId: string) =>
    adminAxios.get(`/api/admin/devices/${deviceId}/app-blocks`),

  deleteAppBlock: (ruleId: string) =>
    adminAxios.delete(`/api/admin/app-blocks/${ruleId}`),
};
