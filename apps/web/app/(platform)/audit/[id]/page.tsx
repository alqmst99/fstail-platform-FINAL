// apps/web/app/(platform)/audit/[id]/page.tsx
// Server component shell — fetches audit, renders client section editor.

import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { StatusBadge } from '../../../../components/ui/status-badge';
import { AuditDetailClient } from '../../../../components/audit/audit-detail-client';
import type { Metadata } from 'next';

async function fetchAudit(id: string) {
  const token = cookies().get('accessToken')?.value;
  const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${API}/api/audits/${id}`, {
    headers: { Cookie: `accessToken=${token}` },
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to load audit');
  return res.json();
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const audit = await fetchAudit(params.id);
  return { title: audit?.title ?? 'Audit' };
}

export default async function AuditDetailPage({ params }: { params: { id: string } }) {
  const audit = await fetchAudit(params.id);
  if (!audit) notFound();

  const isDone = audit.status === 'DONE' || audit.status === 'ARCHIVED';

  return (
    <div className="flex h-full flex-col">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-700 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/audit" className="text-sm text-surface-500 hover:text-surface-300">
            ← Audits
          </Link>
          <span className="text-surface-600">/</span>
          <h1 className="text-lg font-semibold text-surface-50">{audit.title}</h1>
          <StatusBadge status={audit.status} />
        </div>
        <div className="flex items-center gap-2">
          {audit.client && (
            <Link
              href={`/crm/clients/${audit.client.id}`}
              className="text-xs text-surface-500 hover:text-gold-400"
            >
              {audit.client.name}
            </Link>
          )}
        </div>
      </div>

      {/* Client section editor with live score */}
      <div className="flex-1 overflow-auto">
        <AuditDetailClient audit={audit} />
      </div>
    </div>
  );
}
