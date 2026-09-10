// apps/web/app/(platform)/layout.tsx  — Phase 9 update
// Adds <UpdateBanner /> at the very top of the app shell.
// Replace the Phase 3 version with this file.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { UpdateBanner } from '../../components/update-banner';
import { PlatformAuthGate } from '../../components/auth/platform-auth-gate';
import { PlatformSidebar } from '../../components/layout/platform-sidebar';

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
          <PlatformSidebar />

          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </PlatformAuthGate>
  );
}
    