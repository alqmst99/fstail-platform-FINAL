// apps/web/app/(platform)/layout.tsx  — Phase 9 update
// Adds <UpdateBanner /> at the very top of the app shell.
// Replace the Phase 3 version with this file.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { UpdateBanner } from '../../components/update-banner';
import { PlatformAuthGate } from '../../components/auth/platform-auth-gate';

async function getServerUser() {
  const cookieStore = cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  if (!accessToken) return null;

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/auth/me`,
      {
        headers: { Cookie: `accessToken=${accessToken}` },
        cache: 'no-store',
      },
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlatformAuthGate>
      <div className="flex h-screen flex-col bg-surface-900 overflow-hidden">
        <UpdateBanner />

        <div className="flex flex-1 overflow-hidden">
          <aside className="flex w-56 flex-col border-r border-surface-700 bg-surface-950 flex-shrink-0">
            <div className="flex h-12 items-center border-b border-surface-700 px-4">
              <span className="text-sm font-bold text-gold-500">FSTail</span>
              <span className="ml-1 text-sm font-light text-surface-400">
                Platform
              </span>
            </div>

            <nav className="flex-1 space-y-0.5 px-2 py-3">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-surface-400 transition hover:bg-surface-800 hover:text-surface-50"
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="border-t border-surface-700 px-3 py-3">
              <a
                href="/settings"
                className="block text-xs text-surface-600 hover:text-surface-400 transition"
              >
                Settings →
              </a>
            </div>
          </aside>

          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </PlatformAuthGate>
  );
}

const NAV_ITEMS = [
  { href: '/radar',    icon: '📡', label: 'Radar'    },
  { href: '/audit',    icon: '🔍', label: 'Audit'    },
  { href: '/crm',      icon: '👥', label: 'CRM'      },
  { href: '/reports',  icon: '📊', label: 'Reports'  },
  { href: '/settings', icon: '⚙️', label: 'Settings' },
];
    