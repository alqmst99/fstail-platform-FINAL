'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { projectsApi, type Project } from '../../../../lib/crm-api';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  ON_HOLD: 'On hold',
  CANCELLED: 'Cancelled',
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, st] = await Promise.all([
        projectsApi.list({ page, pageSize: 25, ...(search ? { search } : {}) }),
        projectsApi.stats(),
      ]);
      setProjects(list.data || []);
      setTotalPages(list.totalPages || 1);
      setStats(st);
    } catch (e: any) {
      setError(e.message || 'No se pudieron cargar los proyectos');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => setPage(1), [search]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-700 px-4 py-4 sm:px-6">
        <div>
          <h1 className="text-lg font-semibold text-surface-50">Projects</h1>
          {stats && (
            <p className="text-sm text-surface-400">
              {stats.total ?? 0} total · {stats.active ?? 0} active · {stats.completed ?? 0} completed
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

      <div className="border-b border-surface-700 px-4 py-3 sm:px-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar proyectos…"
          className="w-full max-w-sm rounded-md border border-surface-600 bg-surface-900 px-3 py-1.5 text-sm text-surface-50 placeholder-surface-500 outline-none focus:border-gold-500"
        />
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {loading && <p className="text-sm text-surface-500">Cargando…</p>}
        {error && (
          <p className="mb-3 rounded-md border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        {!loading && !error && projects.length === 0 && (
          <div className="rounded-xl border border-surface-700 bg-surface-900 p-10 text-center">
            <p className="text-sm text-surface-400">No hay proyectos todavía.</p>
            <Link href="/crm/projects/new" className="mt-3 inline-block text-sm text-gold-400 hover:text-gold-300">
              Crear el primero →
            </Link>
          </div>
        )}
        <div className="space-y-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/crm/projects/${p.id}`}
              className="block rounded-xl border border-surface-700 bg-surface-900/80 p-4 transition hover:border-gold-500/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-surface-100">{p.title}</h3>
                  <p className="mt-1 text-xs text-surface-500">
                    {(p as any).client?.name || 'Sin cliente'} · {new Date(p.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-surface-800 px-2.5 py-1 text-xs text-surface-300">
                  {STATUS_LABEL[p.status] || p.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-xs text-surface-500">
            <span>
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={page === 1} onClick={() => setPage((x) => x - 1)} className="rounded border border-surface-700 px-3 py-1.5 disabled:opacity-30">
                Anterior
              </button>
              <button type="button" disabled={page === totalPages} onClick={() => setPage((x) => x + 1)} className="rounded border border-surface-700 px-3 py-1.5 disabled:opacity-30">
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
