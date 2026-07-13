// apps/web/app/portal/[token]/page.tsx
// Completely public — no auth, no platform layout.
// Renders the report content for the client using the time-limited token.

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BlockRenderer } from '../../../components/reports/block-renderer';

async function fetchPortalReport(token: string) {
  const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${API}/api/reports/portal/${token}`, {
    cache: 'no-store',
  });

  if (res.status === 404) return { error: 'not_found' as const };
  if (res.status === 403) return { error: 'expired' as const };
  if (!res.ok)            return { error: 'not_found' as const };

  const data = await res.json();
  return { data };
}

export async function generateMetadata({
  params,
}: {
  params: { token: string };
}): Promise<Metadata> {
  const result = await fetchPortalReport(params.token);
  if (result.error) return { title: 'Report' };
  return {
    title: `${result.data.title} | FSTail Report`,
    robots: 'noindex', // Don't index client reports
  };
}

export default async function PortalPage({
  params,
}: {
  params: { token: string };
}) {
  const result = await fetchPortalReport(params.token);

  // Error states
  if (result.error === 'expired') {
    return <PortalError message="This report link has expired. Please contact your provider for a new link." />;
  }
  if (result.error) {
    return <PortalError message="This report link is invalid or has been removed." />;
  }

  const report = result.data;
  const blocks = report.content?.blocks ?? [];

  return (
    <div className="min-h-screen bg-surface-950">

      {/* Portal header */}
      <header className="border-b border-surface-800 bg-surface-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-bold text-gold-500">FSTail</span>
              <span className="text-sm font-light text-surface-400">Solutions</span>
            </div>
            <p className="text-xs text-surface-500">
              Report prepared for {report.workspace?.name ?? 'your team'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-surface-400">{report.title}</p>
            <p className="text-xs text-surface-600">
              {new Date(report.updatedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </header>

      {/* Report content */}
      <main className="mx-auto max-w-4xl px-6 py-10 print:py-0">

        {/* Title */}
        <div className="mb-8 print:mb-4">
          <h1 className="text-3xl font-bold text-surface-50 print:text-gray-900">
            {report.title}
          </h1>
          <p className="mt-2 text-sm text-surface-400 print:text-gray-500">
            Prepared by {report.workspace?.name} ·{' '}
            {new Date(report.updatedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <BlockRenderer blocks={blocks} isPortal={true} />

        {/* Footer */}
        <footer className="mt-16 border-t border-surface-800 pt-6 print:border-gray-200">
          <p className="text-xs text-surface-600 print:text-gray-400">
            This report was prepared by FSTail Solutions and is intended for the
            recipient only. This link expires on{' '}
            {report.portalTokenExpiresAt
              ? new Date(report.portalTokenExpiresAt).toLocaleDateString()
              : 'a set date'}
            .
          </p>
        </footer>
      </main>
    </div>
  );
}

// ── Error state component ─────────────────────────────────────────────

function PortalError({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950 px-4">
      <div className="text-center">
        <p className="text-4xl mb-4">🔗</p>
        <h1 className="text-lg font-semibold text-surface-50 mb-2">
          Link unavailable
        </h1>
        <p className="text-sm text-surface-400 max-w-sm">{message}</p>
      </div>
    </div>
  );
}
