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

  userDetail: (userId: string) =>
    adminAxios.get(`/api/admin/users/${userId}`),

  deleteUser: (userId: string) =>
    adminAxios.delete(`/api/admin/users/${userId}`),
};
