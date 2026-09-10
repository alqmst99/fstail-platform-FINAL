'use client';

import { useState } from 'react';

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
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-56'} flex shrink-0 flex-col border-r border-teal-800/60 bg-[#071a1d] transition-[width] duration-300`}>
      <div className="flex h-12 items-center justify-between border-b border-teal-800/60 px-3">
        {!collapsed && <span className="text-sm font-bold tracking-wide text-gold-400">FSTail <span className="font-light text-teal-100/50">Platform</span></span>}
        <button
          type="button"
          title={collapsed ? 'Mostrar navegación' : 'Ocultar navegación'}
          onClick={() => setCollapsed((value) => !value)}
          className="ml-auto rounded-md px-2 py-1 text-teal-100/60 hover:bg-teal-900/60 hover:text-gold-300"
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-3">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            className="flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-teal-100/60 transition hover:bg-teal-900/60 hover:text-gold-300"
          >
            <span className="w-5 text-center text-base text-gold-500">{item.icon}</span>
            {!collapsed && item.label}
          </a>
        ))}
      </nav>

      {!collapsed && (
        <div className="border-t border-teal-800/60 px-3 py-3">
          <a href="/settings" className="text-xs text-teal-100/40 hover:text-gold-300">Configurar espacio →</a>
        </div>
      )}
    </aside>
  );
}
