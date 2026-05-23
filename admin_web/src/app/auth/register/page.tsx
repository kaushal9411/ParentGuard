'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, Mail, Lock, User, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { authApi } from '@/lib/api';
import { saveAuth } from '@/lib/auth';
import type { AuthResponse } from '@/types';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await authApi.register({ name: form.name, email: form.email, password: form.password });
      const data = res.data as AuthResponse;
      saveAuth(data.token, { userId: data.userId, name: data.name, email: data.email, role: data.role });
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(typeof msg === 'string' ? msg : 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const features = [
    'Real-time GPS location tracking',
    'App usage monitoring & screen time',
    'Notification monitoring',
    'Instant alerts for suspicious activity',
    'Multi-device support',
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="ParentGard" className="w-10 h-10 object-contain" />
          <span className="text-white font-bold text-xl">ParentGard</span>
        </div>

        <div>
          <h1 className="text-4xl font-extrabold text-white leading-tight mb-4">
            Everything you need<br />to protect your child
          </h1>
          <p className="text-blue-200 mb-8">Start monitoring in minutes. No technical knowledge required.</p>
          <ul className="space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-3 text-blue-100">
                <CheckCircle2 size={18} className="text-green-400 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-blue-300 text-sm">© 2026 ParentGard. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="ParentGard" className="w-8 h-8 object-contain" />
            <span className="font-bold text-xl text-primary">ParentGard</span>
          </div>

          <h2 className="text-3xl font-extrabold text-gray-900 mb-1">Create your account</h2>
          <p className="text-gray-500 mb-8">Set up your parent dashboard — free to start</p>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-6 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <div className="relative">
                <User size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input required value={form.name} onChange={set('name')}
                  className="input pl-10" placeholder="John Smith" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <div className="relative">
                <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="email" required value={form.email} onChange={set('email')}
                  className="input pl-10" placeholder="you@example.com" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type={showPass ? 'text' : 'password'} required value={form.password}
                  onChange={set('password')} className="input pl-10 pr-10" placeholder="Min. 6 characters" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="password" required value={form.confirm} onChange={set('confirm')}
                  className="input pl-10" placeholder="Re-enter password" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 mt-2">
              {loading
                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-8">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-primary font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
