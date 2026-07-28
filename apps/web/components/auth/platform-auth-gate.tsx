'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '../../lib/api';

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
      <div className="flex h-screen items-center justify-center bg-surface-900 text-surface-400">
        Cargando…
      </div>
    );
  }
  if (!ok) return null;
  return <>{children}</>;
}