import axios from 'axios';
import { getToken, clearAuth } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

const api = axios.create({ baseURL: API_URL });

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401; upgrade prompt on 403 plan_limit
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      clearAuth();
      window.location.href = '/auth/login';
    }
    if (err.response?.status === 403 && err.response?.data?.upgradeRequired && typeof window !== 'undefined') {
      // Dynamic import to avoid SSR issues with sonner
      import('sonner').then(({ toast }) => {
        toast.error('Feature not available on your plan — upgrade to access this.', {
          action: { label: 'Upgrade', onClick: () => { window.location.href = '/dashboard/subscription'; } },
          duration: 6000,
        });
      });
    }
    return Promise.reject(err);
  },
);

export default api;

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: {
    name: string; email: string; password: string;
  }) =>
    api.post('/api/auth/register', {
      ...data,
      deviceId: `web-${Date.now()}`,
      deviceName: 'Web Portal',
      deviceRole: 'parent',
    }),

  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),

  me: () => api.get('/api/auth/me'),

  forgotPassword: (email: string) =>
    api.post('/api/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post('/api/auth/reset-password', { token, password }),
};

// ── Devices ───────────────────────────────────────────────────────────────────
export const devicesApi = {
  list: () => api.get('/api/devices'),
  get: (deviceId: string) => api.get(`/api/devices/${deviceId}`),
  create: (data: { deviceId: string; deviceName: string; deviceRole: 'child' | 'parent' }) =>
    api.post('/api/devices', data),
  deleteData: (deviceId: string) => api.delete(`/api/user/devices/${deviceId}/data`),
  delete:     (deviceId: string) => api.delete(`/api/user/devices/${deviceId}`),
};

// ── Location ──────────────────────────────────────────────────────────────────
export const locationApi = {
  history: (deviceId: string, limit = 50) =>
    api.get(`/api/location/${deviceId}`, { params: { limit } }),
};

// ── Usage ─────────────────────────────────────────────────────────────────────
export const usageApi = {
  daily: (deviceId: string, date?: string) =>
    api.get(`/api/usage/${deviceId}`, { params: { date } }),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsApi = {
  list: (deviceId: string, limit = 50) =>
    api.get(`/api/notifications/${deviceId}`, { params: { limit } }),
};

// ── User: Call Logs ───────────────────────────────────────────────────────────
export const userCallsApi = {
  list: (deviceId: string, limit = 200, search?: string) =>
    api.get('/api/user/calls', { params: { deviceId, limit, ...(search ? { search } : {}) } }),
};

// ── User: Contacts ────────────────────────────────────────────────────────────
export const userContactsApi = {
  list: (deviceId: string, limit = 500, search?: string) =>
    api.get('/api/user/contacts', { params: { deviceId, limit, ...(search ? { search } : {}) } }),
};

// ── User: Gallery ─────────────────────────────────────────────────────────────
export const userGalleryApi = {
  list: (deviceId: string, type?: 'image' | 'video', limit = 200) =>
    api.get('/api/user/gallery', { params: { deviceId, ...(type ? { type } : {}), limit } }),
};

// ── User: SMS ─────────────────────────────────────────────────────────────────
export const userSmsApi = {
  list: (deviceId: string, limit = 200, search?: string) =>
    api.get('/api/user/sms', { params: { deviceId, limit, ...(search ? { search } : {}) } }),
};

// ── User: Browsing History ────────────────────────────────────────────────────
export const userBrowsingApi = {
  list: (deviceId: string, limit = 200, search?: string) =>
    api.get('/api/user/browsing', { params: { deviceId, limit, ...(search ? { search } : {}) } }),
};

// ── User: Remote Commands ─────────────────────────────────────────────────────
export const userCommandsApi = {
  list:  (deviceId: string, limit = 50) =>
    api.get('/api/user/commands', { params: { deviceId, limit } }),
  issue: (deviceId: string, commandType: string, payload?: Record<string, unknown>) =>
    api.post('/api/user/commands', { deviceId, commandType, payload }),
};

// ── User: Geofences ───────────────────────────────────────────────────────────
export const userGeofencesApi = {
  list:   (deviceId: string) =>
    api.get('/api/user/geofences', { params: { deviceId } }),
  create: (data: { deviceId: string; name: string; latitude: number; longitude: number; radiusM: number }) =>
    api.post('/api/user/geofences', data),
  update: (id: string, data: { isActive?: boolean; name?: string; radiusM?: number }) =>
    api.patch(`/api/user/geofences/${id}`, data),
  delete: (id: string) =>
    api.delete(`/api/user/geofences/${id}`),
};

// ── User: App Block Rules ─────────────────────────────────────────────────────
export const userAppBlocksApi = {
  list:   (deviceId: string) =>
    api.get('/api/user/app-blocks', { params: { deviceId } }),
  create: (data: { deviceId: string; packageName: string; appName: string; isBlocked?: boolean }) =>
    api.post('/api/user/app-blocks', data),
  update: (id: string, isBlocked: boolean) =>
    api.patch(`/api/user/app-blocks/${id}`, { isBlocked }),
  delete: (id: string) =>
    api.delete(`/api/user/app-blocks/${id}`),
};
