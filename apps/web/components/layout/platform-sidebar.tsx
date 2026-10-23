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

/** Pestañas tipo archivador en la parte superior (reemplaza el aside lateral). */
export function PlatformSidebar() {
  const pathname = usePathname() || '';

  return (
    <header className="shrink-0 border-b border-teal-800/80 bg-[#061416]">
      <div className="flex items-end gap-0 px-2 pt-2 overflow-x-auto">
        <span className="mb-2 mr-3 shrink-0 self-center px-2 text-sm font-bold tracking-wide text-gold-400">
          FSTail
        </span>
        <nav className="flex items-end gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <a
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-1.5 rounded-t-lg border border-b-0 px-3.5 py-2 text-sm whitespace-nowrap transition ${
                  active
                    ? 'z-10 border-teal-600/80 bg-surface-900 text-gold-300 -mb-px pb-2.5 shadow-[0_-2px_8px_rgba(0,0,0,0.25)]'
                    : 'border-transparent bg-teal-950/50 text-teal-100/55 hover:bg-teal-900/50 hover:text-gold-300'
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
