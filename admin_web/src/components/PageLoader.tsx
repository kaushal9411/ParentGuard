'use client';
import { useId } from 'react';

interface PageLoaderProps {
  theme?: 'light' | 'dark';
  text?: string;
}

export default function PageLoader({ theme = 'light', text = 'Loading…' }: PageLoaderProps) {
  const uid   = useId().replace(/:/g, '');
  const isDark = theme === 'dark';
  const gradA = `pm-a-${uid}`;
  const gradB = `pm-b-${uid}`;

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[320px] gap-6">

      {/* SVG gradient spinner — most reliable cross-browser approach */}
      <div className="relative w-20 h-20">
        {/* Background track */}
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40" cy="40" r="34"
            fill="none"
            stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
            strokeWidth="5"
          />
        </svg>

        {/* Spinning gradient arc */}
        <svg
          className="absolute inset-0 w-20 h-20 animate-spin"
          style={{ animationDuration: '1s' }}
          viewBox="0 0 80 80"
        >
          <defs>
            <linearGradient id={gradA} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#6366f1" />
              <stop offset="50%"  stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle
            cx="40" cy="40" r="34"
            fill="none"
            stroke={`url(#${gradA})`}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="130 84"
            transform="rotate(-90 40 40)"
          />
        </svg>

        {/* Counter-spinning inner arc */}
        <svg
          className="absolute inset-[12px] w-14 h-14 animate-spin"
          style={{ animationDuration: '0.65s', animationDirection: 'reverse' }}
          viewBox="0 0 56 56"
        >
          <defs>
            <linearGradient id={gradB} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%"   stopColor="#ec4899" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle
            cx="28" cy="28" r="22"
            fill="none"
            stroke={`url(#${gradB})`}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="70 69"
            transform="rotate(-90 28 28)"
          />
        </svg>

        {/* Centre pulse dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-4 h-4 rounded-full animate-pulse"
            style={{ background: 'linear-gradient(135deg,#6366f1,#ec4899)' }}
          />
        </div>
      </div>

      {/* Bouncing dots */}
      <div className="flex items-end gap-1.5 h-4">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block w-2 h-2 rounded-full"
            style={{
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              animation: 'pm-bounce 1.1s ease-in-out infinite',
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
      </div>

      {/* Label */}
      <p className={`text-sm font-medium tracking-wide animate-pulse ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        {text}
      </p>

      <style>{`
        @keyframes pm-bounce {
          0%, 100% { transform: translateY(0);    opacity: .4; }
          50%       { transform: translateY(-7px); opacity: 1;  }
        }
      `}</style>
    </div>
  );
}
