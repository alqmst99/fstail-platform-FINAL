// apps/web/app/(platform)/crm/clients/[id]/page.tsx
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { StatusBadge } from '../../../../../components/ui/status-badge';
import type { Metadata } from 'next';

async function fetchClient(id: string) {
  const token = cookies().get('accessToken')?.value;
  const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  const res = await fetch(`${API}/api/clients/${id}`, {
    headers: { Cookie: `accessToken=${token}` },
    cache: 'no-store',
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to load client');
  return res.json();
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const client = await fetchClient(params.id);
  return { title: client?.name ?? 'Client' };
}

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const client = await fetchClient(params.id);
  if (!client) notFound();

  return (
    <div className="flex h-full flex-col">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-700 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/crm/clients" className="text-surface-500 hover:text-surface-300 text-sm">
            ← Clients
          </Link>
          <span className="text-surface-600">/</span>
          <h1 className="text-lg font-semibold text-surface-50">{client.name}</h1>
          <StatusBadge status={client.status} />
        </div>
        <Link
          href={`/crm/clients/${client.id}/edit`}
          className="rounded-md border border-surface-600 px-3 py-1.5 text-sm text-surface-300 hover:bg-surface-800 transition"
        >
          Edit
        </Link>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">

          {/* Info card */}
          <div className="rounded-lg border border-surface-700 bg-surface-800 p-5">
            <h2 className="mb-4 text-sm font-medium text-surface-300 uppercase tracking-wider">
              Contact info
            </h2>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                { label: 'Email', value: client.email },
                { label: 'Phone', value: client.phone },
                { label: 'Website', value: client.website },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs text-surface-500">{label}</dt>
                  <dd className="mt-0.5 text-sm text-surface-100">
                    {value ? (
                      label === 'Website' ? (
                        <a href={value} target="_blank" rel="noopener noreferrer"
                          className="text-gold-400 hover:text-gold-300">
                          {value}
                        </a>
                      ) : value
                    ) : (
                      <span className="text-surface-600">—</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            {client.notes && (
              <div className="mt-4 border-t border-surface-700 pt-4">
                <dt className="text-xs text-surface-500">Notes</dt>
                <dd className="mt-1 text-sm text-surface-300 whitespace-pre-wrap">{client.notes}</dd>
              </div>
            )}
          </div>

          {/* Projects */}
          <div className="rounded-lg border border-surface-700 bg-surface-800 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-surface-300 uppercase tracking-wider">
                Projects ({client.projects.length})
              </h2>
              <Link
                href={`/crm/projects/new?clientId=${client.id}`}
                className="text-xs text-gold-500 hover:text-gold-400"
              >
                + Add project
              </Link>
            </div>
            {client.projects.length === 0 ? (
              <p className="text-sm text-surface-500">No projects yet</p>
            ) : (
              <div className="space-y-2">
                {client.projects.map((p: any) => (
                  <Link
                    key={p.id}
                    href={`/crm/projects/${p.id}`}
                    className="flex items-center justify-between rounded-md border border-surface-700 px-3 py-2 hover:bg-surface-700/50 transition"
                  >
                    <span className="text-sm text-surface-100">{p.title}</span>
                    <StatusBadge status={p.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent audits */}
          <div className="rounded-lg border border-surface-700 bg-surface-800 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-surface-300 uppercase tracking-wider">
                Recent audits
              </h2>
              <Link
                href={`/audit/new?clientId=${client.id}`}
                className="text-xs text-gold-500 hover:text-gold-400"
              >
                + New audit
              </Link>
            </div>
            {client.audits.length === 0 ? (
              <p className="text-sm text-surface-500">No audits yet</p>
            ) : (
              <div className="space-y-2">
                {client.audits.map((a: any) => (
                  <Link
                    key={a.id}
                    href={`/audit/${a.id}`}
                    className="flex items-center justify-between rounded-md border border-surface-700 px-3 py-2 hover:bg-surface-700/50 transition"
                  >
                    <span className="text-sm text-surface-100">{a.title}</span>
                    <div className="flex items-center gap-3">
                      {a.finalScore !== null && (
                        <span className="text-sm font-mono font-bold text-gold-400">
                          {a.finalScore}/10
                        </span>
                      )}
                      <StatusBadge status={a.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
