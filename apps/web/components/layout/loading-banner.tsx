'use client';

export function LoadingBanner() {
  return (
    <div className="relative overflow-hidden border-b border-teal-700/50 bg-[#0b2528] px-5 py-2.5 text-sm text-teal-100/80" role="status" aria-live="polite">
      <div className="absolute inset-y-0 left-0 w-1/3 animate-[loading-sweep_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-gold-400/30 to-transparent" />
      <div className="relative flex items-center justify-center gap-3">
        <span className="h-2 w-2 animate-pulse rounded-full bg-gold-400" />
        <span>Preparando tu espacio de trabajo</span>
        <span className="flex gap-1" aria-hidden="true"><i className="h-1 w-1 animate-bounce rounded-full bg-teal-300" /><i className="h-1 w-1 animate-bounce rounded-full bg-teal-300 [animation-delay:150ms]" /><i className="h-1 w-1 animate-bounce rounded-full bg-teal-300 [animation-delay:300ms]" /></span>
      </div>
    </div>
  );
}
