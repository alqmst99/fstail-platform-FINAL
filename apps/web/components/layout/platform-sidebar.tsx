'use client';

import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', icon: '⌂', label: 'Home' },
  { href: '/radar', icon: '◈', label: 'Radar' },
  { href: '/applications', icon: '↗', label: 'Postulaciones' },
  { href: '/crm', icon: '◇', label: 'CRM' },
  { href: '/audit', icon: '◎', label: 'Audits' },
  { href: '/reports', icon: '▤', label: 'Reports' },
  { href: '/settings', icon: '⚙', label: 'Settings' },
];

export function PlatformSidebar() {
  const pathname = usePathname() || '';

  return (
    <header className="shrink-0 border-b border-teal-800/60 bg-[#071a1d]">
      <div className="flex h-12 items-center gap-2 px-3 overflow-x-auto">
        <span className="mr-2 shrink-0 text-sm font-bold tracking-wide text-gold-400">
          FSTail <span className="font-light text-teal-100/50">Platform</span>
        </span>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition ${
                  active
                    ? 'bg-teal-900/80 text-gold-300'
                    : 'text-teal-100/60 hover:bg-teal-900/60 hover:text-gold-300'
                }`}
              >
                <span className="text-base text-gold-500">{item.icon}</span>
                {item.label}
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
