'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '../../lib/api';
import { LoadingBanner } from '../layout/loading-banner';

export function PlatformAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await authApi.me(); // credentials: 'include' → manda cookie a Render
        if (!cancelled) setOk(true);
      } catch {
        if (!cancelled) router.replace('/login');
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) {
    return (
      <div className="relative flex h-screen flex-col items-stretch justify-center overflow-hidden bg-[#071a1d] text-teal-100/70">
        <LoadingBanner />
        <div className="flex flex-1 items-center justify-center">
        <div className="absolute inset-x-0 top-0 h-1 animate-pulse bg-gold-400" />
        <div className="rounded-2xl border border-teal-700/60 bg-[#0b2528] px-10 py-8 text-center shadow-2xl shadow-teal-950/40">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-teal-700 border-t-gold-400" />
          <p className="text-sm font-medium text-gold-300">FSTail Platform</p>
          <p className="mt-1 text-xs text-teal-100/50">Preparando tu espacio de trabajo</p>
        </div>
        </div>
      </div>
    );
  }
  if (!ok) return null;
  return <>{children}</>;
}