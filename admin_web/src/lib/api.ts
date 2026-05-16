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

// Auto-logout on 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      clearAuth();
      window.location.href = '/auth/login';
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
};

// ── Devices ───────────────────────────────────────────────────────────────────
export const devicesApi = {
  list: () => api.get('/api/devices'),
  get: (deviceId: string) => api.get(`/api/devices/${deviceId}`),
  create: (data: { deviceId: string; deviceName: string; deviceRole: 'child' | 'parent' }) =>
    api.post('/api/devices', data),
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
