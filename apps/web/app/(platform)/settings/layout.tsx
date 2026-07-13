// apps/web/app/(platform)/settings/layout.tsx
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Settings' };

const TABS = [
  { href: '/settings/account',      label: 'Account'      },
  { href: '/settings/workspace',    label: 'Workspace'    },
  { href: '/settings/team',         label: 'Team'         },
  { href: '/settings/integrations', label: 'Integrations' },
];

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
      <div className="flex gap-1 border-b border-surface-700 px-6">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="relative px-3 py-2.5 text-sm text-surface-400 transition hover:text-surface-200
              [&.active]:text-surface-50 [&.active]:after:absolute [&.active]:after:bottom-0
              [&.active]:after:left-0 [&.active]:after:right-0 [&.active]:after:h-0.5
              [&.active]:after:bg-gold-500 [&.active]:after:rounded-t"
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}
