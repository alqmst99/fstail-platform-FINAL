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

/** Nav superior: móvil = solo iconos; md+ = icono + texto */
export function PlatformSidebar() {
  const pathname = usePathname() || '';

  return (
    <header className="shrink-0 border-b border-teal-800/80 bg-[#061416]">
      <div className="flex h-12 items-center gap-1 px-1.5 sm:px-3">
        <span className="mr-1 hidden shrink-0 px-2 text-sm font-bold tracking-wide text-gold-400 xs:inline sm:mr-2 sm:inline">
          FSTail
        </span>
        <span className="mr-1 shrink-0 px-1.5 text-sm font-bold text-gold-400 sm:hidden">FS</span>
        <nav className="flex flex-1 items-center justify-between gap-0.5 sm:justify-start sm:gap-1">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <a
                key={item.href}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                className={`flex min-w-[2.5rem] flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm transition sm:flex-none sm:px-3 ${
                  active
                    ? 'bg-teal-900/80 text-gold-300'
                    : 'text-teal-100/55 hover:bg-teal-900/50 hover:text-gold-300'
                }`}
              >
                <span className="text-lg leading-none text-gold-500 sm:text-base">{item.icon}</span>
                <span className="hidden md:inline">{item.label}</span>
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
