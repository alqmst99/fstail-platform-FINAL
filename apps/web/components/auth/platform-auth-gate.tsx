'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, startProactiveTokenRefresh, stopProactiveTokenRefresh } from '../../lib/api';

/** Pantalla de carga animada — sin saltar de inmediato a /login */
export function PlatformAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  const [checking, setChecking] = useState(true);
  const [phase, setPhase] = useState<'boot' | 'auth' | 'ready' | 'redirect'>('boot');

  useEffect(() => {
    let cancelled = false;
    const bootTimer = setTimeout(() => {
      if (!cancelled) setPhase('auth');
    }, 80);

    (async () => {
      try {
        await authApi.me();
        if (cancelled) return;
        setOk(true);
        setPhase('ready');
        startProactiveTokenRefresh();
      } catch {
        if (cancelled) return;
        // Mantener loader un momento y redirigir sin “flash”
        setPhase('redirect');
        await new Promise((r) => setTimeout(r, 250));
        if (!cancelled) router.replace('/login');
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(bootTimer);
      stopProactiveTokenRefresh();
    };
  }, [router]);

  if (checking || phase === 'boot' || phase === 'auth' || phase === 'redirect' || !ok) {
    return (
      <div className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-[#071a1d] text-teal-100/70">
        {/* fondo animado */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-1/4 h-72 w-72 animate-pulse rounded-full bg-teal-500/10 blur-3xl" />
          <div className="absolute -right-16 bottom-1/4 h-64 w-64 animate-pulse rounded-full bg-gold-500/10 blur-3xl [animation-delay:400ms]" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-5 px-6 text-center">
          <div className="relative">
            <div className="h-14 w-14 animate-spin rounded-full border-2 border-teal-700/60 border-t-gold-400" />
            <div className="absolute inset-2 animate-pulse rounded-full bg-gold-400/10" />
          </div>
          <div>
            <p className="text-base font-semibold tracking-wide text-gold-300">FSTail Platform</p>
            <p className="mt-1.5 text-xs text-teal-100/50">
              {phase === 'redirect'
                ? 'Sesión no encontrada…'
                : phase === 'boot'
                  ? 'Iniciando…'
                  : 'Verificando sesión…'}
            </p>
          </div>
          {/* barra de progreso indeterminada */}
          <div className="h-1 w-48 overflow-hidden rounded-full bg-teal-900/80">
            <div className="h-full w-1/3 animate-[loading-sweep_1.6s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-transparent via-gold-400 to-transparent" />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
