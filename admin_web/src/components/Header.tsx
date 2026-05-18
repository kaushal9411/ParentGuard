'use client';
import { useEffect, useState } from 'react';
import { Bell, User } from 'lucide-react';
import { getUser } from '@/lib/auth';

interface Props { title: string; subtitle?: string; }

export default function Header({ title, subtitle }: Props) {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    setUser(getUser<{ name: string; email: string }>());
  }, []);

  return (
    <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <Bell size={20} className="text-gray-500" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full" />
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
          <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center">
            <User size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-none">{user?.name ?? ''}</p>
            <p className="text-xs text-gray-500 mt-0.5">{user?.email ?? ''}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
