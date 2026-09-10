// apps/web/app/(platform)/settings/layout.tsx
import type { Metadata } from 'next';
import { SettingsTabs } from '../../../components/layout/settings-tabs';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">

      {/* Header */}
      <div className="border-b border-surface-700 px-6 py-4">
        <h1 className="text-lg font-semibold text-surface-50">Settings</h1>
      </div>

      {/* Tab bar */}
      <SettingsTabs />

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}
