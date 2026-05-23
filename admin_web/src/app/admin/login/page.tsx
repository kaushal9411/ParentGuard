'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import { saveAdminAuth } from '@/lib/adminAuth';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await adminApi.login(email, password);
      saveAdminAuth(res.data.token, {
        userId: res.data.userId,
        name: res.data.name,
        email: res.data.email,
      });
      router.push('/admin/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Invalid admin credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="ParentGard" className="w-16 h-16 object-contain mx-auto mb-4" />
          <h1 className="text-2xl font-extrabold text-white">ParentGard Admin</h1>
          <p className="text-gray-400 mt-1 text-sm">Restricted access — authorised personnel only</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          {error && (
            <div className="flex items-center gap-2 bg-red-900/40 border border-red-700 text-red-300 rounded-xl px-4 py-3 mb-6 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Admin Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@parentguard.com"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder-gray-600" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type={showPass ? 'text' : 'password'} required value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl pl-10 pr-10 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder-gray-600" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold
                         py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2">
              {loading
                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : 'Sign In as Admin'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          For parents, use the{' '}
          <a href="/auth/login" className="text-indigo-400 hover:underline">parent portal</a>
        </p>
      </div>
    </div>
  );
}
