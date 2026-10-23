// apps/web/app/(platform)/layout.tsx
// Horizontal top tabs navigation (replaces left aside).

import { UpdateBanner } from '../../components/update-banner';
import { PlatformAuthGate } from '../../components/auth/platform-auth-gate';
import { PlatformSidebar } from '../../components/layout/platform-sidebar';

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlatformAuthGate>
      <div className="flex h-screen flex-col bg-surface-900 overflow-hidden">
        <UpdateBanner />
        <PlatformSidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </PlatformAuthGate>
  );
}
