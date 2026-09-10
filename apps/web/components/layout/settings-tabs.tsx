'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/settings/account', label: 'Account' },
  { href: '/settings/workspace', label: 'Workspace' },
  { href: '/settings/team', label: 'Team' },
  { href: '/settings/integrations', label: 'Integrations' },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b border-surface-700 px-6">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link key={tab.href} href={tab.href} className={`relative px-3 py-2.5 text-sm transition ${active ? 'text-surface-50 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t after:bg-gold-500' : 'text-surface-400 hover:text-surface-200'}`}>
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
