'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

interface MobileNavValue {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
}

const MobileNavContext = createContext<MobileNavValue>({ open: false, setOpen: () => {}, toggle: () => {} });

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const value = useMemo(() => ({ open, setOpen, toggle }), [open, toggle]);
  return <MobileNavContext.Provider value={value}>{children}</MobileNavContext.Provider>;
}

export const useMobileNav = () => useContext(MobileNavContext);
