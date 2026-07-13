'use client';
// apps/web/components/update-banner.tsx
// Shows a top banner when the desktop app has a pending update.
// Only renders inside Electron — invisible in the browser.

import { useState, useEffect } from 'react';

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
}

export function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).electron) return;

    const el = (window as any).electron;

    // Listen for update available
    const offAvailable = el.updater.onAvailable((info: UpdateInfo) => {
      setUpdate(info);
    });

    // Listen for update downloaded — ready to install
    const offDownloaded = el.updater.onDownloaded((info: UpdateInfo) => {
      setUpdate(info);
      setDownloaded(true);
    });

    return () => {
      offAvailable?.();
      offDownloaded?.();
    };
  }, []);

  if (!update) return null;

  function handleInstall() {
    setInstalling(true);
    (window as any).electron.updater.install();
  }

  return (
    <div className="flex items-center justify-between bg-gold-500 px-4 py-2 text-sm text-surface-900">
      <div className="flex items-center gap-2">
        <span>⬆</span>
        <span className="font-medium">
          {downloaded
            ? `FSTail Platform ${update.version} is ready to install`
            : `FSTail Platform ${update.version} is downloading…`}
        </span>
      </div>
      {downloaded && (
        <button
          onClick={handleInstall}
          disabled={installing}
          className="rounded bg-surface-900 px-3 py-1 text-xs font-semibold text-gold-400 hover:bg-surface-800 disabled:opacity-60 transition"
        >
          {installing ? 'Restarting…' : 'Restart & install'}
        </button>
      )}
    </div>
  );
}
