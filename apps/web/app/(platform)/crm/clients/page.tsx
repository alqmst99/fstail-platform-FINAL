// apps/web/app/(platform)/crm/clients/page.tsx
// Server component — data fetched at request time, no client-side loading state.

import { cookies } from 'next/headers';
import Link from 'next/link';
import { StatusBadge } from '../../../../components/ui/status-badge';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Clients' };

// ── Server-side data fetching ─────────────────────────────────────────

async function fetchClients(searchParams: Record<string, string>) {
  const cookieStore = cookies();
  const token = cookieStore.get('accessToken')?.value;

  const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const qs = new URLSearchParams(searchParams).toString();

  const [clientsRes, statsRes] = await Promise.all([
    fetch(`${API}/api/clients?${qs}`, {
      headers: { Cookie: `accessToken=${token}` },
      cache: 'no-store',
    }),
    fetch(`${API}/api/clients/stats`, {
      headers: { Cookie: `accessToken=${token}` },
      cache: 'no-store',
    }),
  ]);

  const clients = clientsRes.ok ? await clientsRes.json() : { data: [], total: 0, totalPages: 1 };
  const stats = statsRes.ok ? await statsRes.json() : null;
  return { clients, stats };
}

// ── Page ──────────────────────────────────────────────────────────────

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const { clients, stats } = await fetchClients(searchParams);
  const currentPage = Number(searchParams['page'] ?? 1);
  const search = searchParams['search'] ?? '';

  return (
    <div className="flex h-full flex-col">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-700 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-surface-50">Clients</h1>
          {stats && (
            <p className="text-sm text-surface-400">
              {stats.total} total · {stats.active} active · {stats.leads} leads
            </p>
          )}
        </div>
        <Link
          href="/crm/clients/new"
          className="rounded-md bg-gold-500 px-3 py-1.5 text-sm font-semibold text-surface-900 hover:bg-gold-400 transition"
        >
          + New client
        </Link>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-4 gap-px border-b border-surface-700 bg-surface-700">
          {[
            { label: 'Leads',    value: stats.leads,    href: '?status=LEAD'     },
            { label: 'Active',   value: stats.active,   href: '?status=ACTIVE'   },
            { label: 'Inactive', value: stats.inactive, href: '?status=INACTIVE' },
            { label: 'Archived', value: stats.archived, href: '?status=ARCHIVED' },
          ].map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="flex flex-col items-center bg-surface-900 py-3 hover:bg-surface-800 transition"
            >
              <span className="text-xl font-bold text-surface-50">{s.value}</span>
              <span className="text-xs text-surface-500">{s.label}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="border-b border-surface-700 px-6 py-3">
        <form>
          <input
            name="search"
            defaultValue={search}
            placeholder="Search by name, email, phone…"
            className="w-full max-w-sm rounded-md border border-surface-600 bg-surface-800 px-3 py-1.5 text-sm text-surface-50 placeholder-surface-500 outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500"
          />
        </form>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {clients.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-surface-500">
            <p className="text-sm">No clients found</p>
            {search && <p className="mt-1 text-xs">Try a different search term</p>}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-surface-700 bg-surface-900">
              <tr>
                {['Name', 'Email', 'Phone', 'Status', 'Projects', 'Audits', ''].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {clients.data.map((client: any) => (
                <tr key={client.id} className="hover:bg-surface-800/50 transition">
                  <td className="px-6 py-3">
                    <Link
                      href={`/crm/clients/${client.id}`}
                      className="font-medium text-surface-50 hover:text-gold-400"
                    >
                      {client.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-surface-400">{client.email ?? '—'}</td>
                  <td className="px-6 py-3 text-surface-400">{client.phone ?? '—'}</td>
                  <td className="px-6 py-3">
                    <StatusBadge status={client.status} />
                  </td>
                  <td className="px-6 py-3 text-surface-400 tabular-nums">{client._count.projects}</td>
                  <td className="px-6 py-3 text-surface-400 tabular-nums">{client._count.audits}</td>
                  <td className="px-6 py-3">
                    <Link
                      href={`/crm/clients/${client.id}`}
                      className="text-xs text-surface-500 hover:text-surface-300"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {clients.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-surface-700 px-6 py-3">
          <p className="text-xs text-surface-500">
            Page {currentPage} of {clients.totalPages} · {clients.total} total
          </p>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={`?page=${currentPage - 1}${search ? `&search=${search}` : ''}`}
                className="rounded-md border border-surface-600 px-3 py-1 text-xs text-surface-300 hover:bg-surface-800"
              >
                ← Prev
              </Link>
            )}
            {currentPage < clients.totalPages && (
              <Link
                href={`?page=${currentPage + 1}${search ? `&search=${search}` : ''}`}
                className="rounded-md border border-surface-600 px-3 py-1 text-xs text-surface-300 hover:bg-surface-800"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
