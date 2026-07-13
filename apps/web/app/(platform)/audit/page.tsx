// apps/web/app/(platform)/audit/page.tsx
import { cookies } from 'next/headers';
import Link from 'next/link';
import { StatusBadge } from '../../../components/ui/status-badge';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Audits' };

async function fetchAudits(searchParams: Record<string, string>) {
  const token = cookies().get('accessToken')?.value;
  const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const qs = new URLSearchParams(searchParams).toString();

  const [listRes, statsRes] = await Promise.all([
    fetch(`${API}/api/audits?${qs}`, {
      headers: { Cookie: `accessToken=${token}` },
      cache: 'no-store',
    }),
    fetch(`${API}/api/audits/stats`, {
      headers: { Cookie: `accessToken=${token}` },
      cache: 'no-store',
    }),
  ]);

  return {
    audits: listRes.ok ? await listRes.json() : { data: [], total: 0, totalPages: 1 },
    stats:  statsRes.ok ? await statsRes.json() : null,
  };
}

function ScoreChip({ score }: { score: number | null }) {
  if (score === null) return <span className="text-surface-600">—</span>;
  const color =
    score >= 9 ? 'text-emerald-400' :
    score >= 7 ? 'text-blue-400' :
    score >= 5 ? 'text-gold-400' :
    score >= 3 ? 'text-orange-400' : 'text-red-400';
  return <span className={`font-mono font-bold tabular-nums ${color}`}>{score}/10</span>;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const { audits, stats } = await fetchAudits(searchParams);
  const currentPage = Number(searchParams['page'] ?? 1);
  const search = searchParams['search'] ?? '';

  return (
    <div className="flex h-full flex-col">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-700 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-surface-50">Audits</h1>
          {stats && (
            <p className="text-sm text-surface-400">
              {stats.total} total
              {stats.avgScore !== null && ` · avg ${stats.avgScore}/10`}
            </p>
          )}
        </div>
        <Link
          href="/audit/new"
          className="rounded-md bg-gold-500 px-3 py-1.5 text-sm font-semibold text-surface-900 hover:bg-gold-400 transition"
        >
          + New audit
        </Link>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-4 gap-px border-b border-surface-700 bg-surface-700">
          {[
            { label: 'Draft',       value: stats.draft,      href: '?status=DRAFT'       },
            { label: 'In progress', value: stats.inProgress, href: '?status=IN_PROGRESS' },
            { label: 'Done',        value: stats.done,       href: '?status=DONE'        },
            { label: 'Archived',    value: stats.archived,   href: '?status=ARCHIVED'    },
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
            placeholder="Search audits…"
            className="w-full max-w-sm rounded-md border border-surface-600 bg-surface-800 px-3 py-1.5 text-sm text-surface-50 placeholder-surface-500 outline-none focus:border-gold-500"
          />
        </form>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {audits.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-surface-500">
            <p className="text-sm">No audits found</p>
            <Link href="/audit/new" className="mt-3 text-xs text-gold-500 hover:text-gold-400">
              Create your first audit →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-surface-700 bg-surface-900">
              <tr>
                {['Title', 'Client', 'Score', 'Status', 'Updated', ''].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {audits.data.map((audit: any) => (
                <tr key={audit.id} className="hover:bg-surface-800/50 transition">
                  <td className="px-6 py-3">
                    <Link
                      href={`/audit/${audit.id}`}
                      className="font-medium text-surface-50 hover:text-gold-400"
                    >
                      {audit.title}
                    </Link>
                    {audit.project && (
                      <p className="text-xs text-surface-500 mt-0.5">{audit.project.title}</p>
                    )}
                  </td>
                  <td className="px-6 py-3 text-surface-400">
                    {audit.client?.name ?? '—'}
                  </td>
                  <td className="px-6 py-3">
                    <ScoreChip score={audit.finalScore} />
                  </td>
                  <td className="px-6 py-3">
                    <StatusBadge status={audit.status} />
                  </td>
                  <td className="px-6 py-3 text-surface-500 text-xs">
                    {new Date(audit.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3">
                    <Link href={`/audit/${audit.id}`} className="text-xs text-surface-500 hover:text-surface-300">
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {audits.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-surface-700 px-6 py-3">
          <p className="text-xs text-surface-500">
            Page {currentPage} of {audits.totalPages} · {audits.total} total
          </p>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link href={`?page=${currentPage - 1}`}
                className="rounded-md border border-surface-600 px-3 py-1 text-xs text-surface-300 hover:bg-surface-800">
                ← Prev
              </Link>
            )}
            {currentPage < audits.totalPages && (
              <Link href={`?page=${currentPage + 1}`}
                className="rounded-md border border-surface-600 px-3 py-1 text-xs text-surface-300 hover:bg-surface-800">
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
