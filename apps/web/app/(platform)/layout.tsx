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
        {/* Pestañas horizontales tipo archivador */}
        <PlatformSidebar />
        <main className="flex-1 overflow-auto border-t border-teal-800/40">{children}</main>
      </div>
    </PlatformAuthGate>
  );
}
