// apps/web/app/(platform)/reports/page.tsx
import { cookies } from 'next/headers';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Reports' };

async function fetchReports(searchParams: Record<string, string>) {
  const token = cookies().get('accessToken')?.value;
  const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const qs = new URLSearchParams(searchParams).toString();

  const res = await fetch(`${API}/api/reports?${qs}`, {
    headers: { Cookie: `accessToken=${token}` },
    cache: 'no-store',
  });
  return res.ok ? res.json() : { data: [], total: 0, totalPages: 1 };
}

function PortalBadge({
  active,
  expiresAt,
}: {
  active: boolean;
  expiresAt: string | null;
}) {
  if (!active) {
    return (
      <span className="rounded border border-surface-700 px-1.5 py-0.5 text-xs text-surface-500">
        Draft
      </span>
    );
  }
  const days = expiresAt
    ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
    : null;
  return (
    <span className="rounded border border-emerald-800 bg-emerald-950 px-1.5 py-0.5 text-xs text-emerald-400">
      Published{days !== null ? ` · ${days}d left` : ''}
    </span>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const reports = await fetchReports(searchParams);
  const currentPage = Number(searchParams['page'] ?? 1);
  const search = searchParams['search'] ?? '';

  return (
    <div className="flex h-full flex-col">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-700 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-surface-50">Reports</h1>
          <p className="text-sm text-surface-400">
            {reports.total} report{reports.total !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/reports/new"
          className="rounded-md bg-gold-500 px-3 py-1.5 text-sm font-semibold text-surface-900 hover:bg-gold-400 transition"
        >
          + New report
        </Link>
      </div>

      {/* Search */}
      <div className="border-b border-surface-700 px-6 py-3">
        <form>
          <input
            name="search"
            defaultValue={search}
            placeholder="Search reports…"
            className="w-full max-w-sm rounded-md border border-surface-600 bg-surface-800 px-3 py-1.5 text-sm text-surface-50 placeholder-surface-500 outline-none focus:border-gold-500"
          />
        </form>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        {reports.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-surface-500">
            <p className="text-sm">No reports yet</p>
            <Link href="/reports/new" className="mt-3 text-xs text-gold-500 hover:text-gold-400">
              Create your first report →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-surface-700 bg-surface-900">
              <tr>
                {['Title', 'Status', 'Created by', 'Updated', ''].map((h) => (
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
              {reports.data.map((r: any) => (
                <tr key={r.id} className="hover:bg-surface-800/50 transition">
                  <td className="px-6 py-3">
                    <Link
                      href={`/reports/${r.id}`}
                      className="font-medium text-surface-50 hover:text-gold-400"
                    >
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-6 py-3">
                    <PortalBadge
                      active={r.portalActive}
                      expiresAt={r.portalTokenExpiresAt}
                    />
                  </td>
                  <td className="px-6 py-3 text-surface-400">
                    {r.createdBy.displayName}
                  </td>
                  <td className="px-6 py-3 text-xs text-surface-500">
                    {new Date(r.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3">
                    <Link
                      href={`/reports/${r.id}`}
                      className="text-xs text-surface-500 hover:text-surface-300"
                    >
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
      {reports.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-surface-700 px-6 py-3">
          <p className="text-xs text-surface-500">
            Page {currentPage} of {reports.totalPages}
          </p>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={`?page=${currentPage - 1}`}
                className="rounded-md border border-surface-600 px-3 py-1 text-xs text-surface-300 hover:bg-surface-800"
              >
                ← Prev
              </Link>
            )}
            {currentPage < reports.totalPages && (
              <Link
                href={`?page=${currentPage + 1}`}
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
