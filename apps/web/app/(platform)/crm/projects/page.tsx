// apps/web/app/(platform)/crm/projects/page.tsx
import { cookies } from 'next/headers';
import Link from 'next/link';
import { StatusBadge } from '../../../../components/ui/status-badge';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Projects' };

async function fetchProjects(searchParams: Record<string, string>) {
  const token = cookies().get('accessToken')?.value;
  const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const qs = new URLSearchParams(searchParams).toString();

  const [projRes, statsRes] = await Promise.all([
    fetch(`${API}/api/projects?${qs}`, {
      headers: { Cookie: `accessToken=${token}` },
      cache: 'no-store',
    }),
    fetch(`${API}/api/projects/stats`, {
      headers: { Cookie: `accessToken=${token}` },
      cache: 'no-store',
    }),
  ]);

  return {
    projects: projRes.ok ? await projRes.json() : { data: [], total: 0, totalPages: 1 },
    stats: statsRes.ok ? await statsRes.json() : null,
  };
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const { projects, stats } = await fetchProjects(searchParams);
  const currentPage = Number(searchParams['page'] ?? 1);
  const search = searchParams['search'] ?? '';

  return (
    <div className="flex h-full flex-col">

      <div className="flex items-center justify-between border-b border-surface-700 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-surface-50">Projects</h1>
          {stats && (
            <p className="text-sm text-surface-400">
              {stats.total} total · {stats.active} active · {stats.completed} completed
            </p>
          )}
        </div>
        <Link
          href="/crm/projects/new"
          className="rounded-md bg-gold-500 px-3 py-1.5 text-sm font-semibold text-surface-900 hover:bg-gold-400 transition"
        >
          + New project
        </Link>
      </div>

      <div className="border-b border-surface-700 px-6 py-3">
        <form>
          <input
            name="search"
            defaultValue={search}
            placeholder="Search projects…"
            className="w-full max-w-sm rounded-md border border-surface-600 bg-surface-800 px-3 py-1.5 text-sm text-surface-50 placeholder-surface-500 outline-none focus:border-gold-500"
          />
        </form>
      </div>

      <div className="flex-1 overflow-auto">
        {projects.data.length === 0 ? (
          <div className="flex items-center justify-center py-24 text-sm text-surface-500">
            No projects found
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-surface-700 bg-surface-900">
              <tr>
                {['Title', 'Client', 'Status', 'Audits', ''].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {projects.data.map((p: any) => (
                <tr key={p.id} className="hover:bg-surface-800/50 transition">
                  <td className="px-6 py-3">
                    <Link href={`/crm/projects/${p.id}`} className="font-medium text-surface-50 hover:text-gold-400">
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-surface-400">
                    {p.client ? (
                      <Link href={`/crm/clients/${p.client.id}`} className="hover:text-surface-200">
                        {p.client.name}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="px-6 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-6 py-3 text-surface-400 tabular-nums">{p._count.audits}</td>
                  <td className="px-6 py-3">
                    <Link href={`/crm/projects/${p.id}`} className="text-xs text-surface-500 hover:text-surface-300">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {projects.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-surface-700 px-6 py-3">
          <p className="text-xs text-surface-500">
            Page {currentPage} of {projects.totalPages} · {projects.total} total
          </p>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link href={`?page=${currentPage - 1}`}
                className="rounded-md border border-surface-600 px-3 py-1 text-xs text-surface-300 hover:bg-surface-800">
                ← Prev
              </Link>
            )}
            {currentPage < projects.totalPages && (
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
