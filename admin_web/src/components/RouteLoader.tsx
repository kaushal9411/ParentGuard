'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Gradient top-progress bar — plays automatically on every route change.
 * Drop it once into each layout; no props needed.
 */
export default function RouteLoader() {
  const pathname  = usePathname();
  const [pct, setPct]       = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef  = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clear() { timerRef.current.forEach(clearTimeout); timerRef.current = []; }

  useEffect(() => {
    clear();
    setVisible(true);
    setPct(0);

    // Fake-progress: rush to 85 %, then stall until next effect fires
    const t0 = setTimeout(() => setPct(30),  30);
    const t1 = setTimeout(() => setPct(55),  150);
    const t2 = setTimeout(() => setPct(75),  350);
    const t3 = setTimeout(() => setPct(85),  600);
    timerRef.current = [t0, t1, t2, t3];

    return () => {
      // When the NEW page has mounted, complete the bar and fade out
      clear();
      setPct(100);
      const done = setTimeout(() => setVisible(false), 400);
      timerRef.current = [done];
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none"
      style={{ background: 'transparent' }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          transition: pct === 100
            ? 'width 0.15s ease-in, opacity 0.25s ease 0.15s'
            : 'width 0.4s cubic-bezier(.4,0,.2,1)',
          opacity: pct === 100 ? 0 : 1,
          background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
          boxShadow: '0 0 12px 2px rgba(139,92,246,0.6)',
          borderRadius: '0 4px 4px 0',
        }}
      />
    </div>
  );
}
