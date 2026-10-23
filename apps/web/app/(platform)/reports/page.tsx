'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { reportsApi, type ReportSummary } from '../../../lib/reports-api';

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await reportsApi.list({ page, ...(search ? { search } : {}) });
      setReports(list.data || []);
      setTotalPages(list.totalPages || 1);
    } catch (e: any) {
      setError(e.message || 'No se pudieron cargar los reports');
      setReports([]);
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
          <h1 className="text-lg font-semibold text-surface-50">Reports</h1>
          <p className="text-sm text-surface-400">Informes y portal cliente</p>
        </div>
        <Link
          href="/reports/new"
          className="rounded-md bg-gold-500 px-3 py-1.5 text-sm font-semibold text-surface-900 hover:bg-gold-400"
        >
          + New report
        </Link>
      </div>

      <div className="border-b border-surface-700 px-4 py-3 sm:px-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar reports…"
          className="w-full max-w-sm rounded-md border border-surface-600 bg-surface-900 px-3 py-1.5 text-sm text-surface-50 placeholder-surface-500 outline-none focus:border-gold-500"
        />
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {loading && <p className="text-sm text-surface-500">Cargando…</p>}
        {error && (
          <p className="mb-3 rounded-md border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>
        )}
        {!loading && !error && reports.length === 0 && (
          <div className="rounded-xl border border-surface-700 bg-surface-900 p-10 text-center">
            <p className="text-sm text-surface-400">No hay reports todavía.</p>
            <Link href="/reports/new" className="mt-3 inline-block text-sm text-gold-400">
              Crear el primero →
            </Link>
          </div>
        )}
        <div className="space-y-2">
          {reports.map((r) => (
            <Link
              key={r.id}
              href={`/reports/${r.id}`}
              className="block rounded-xl border border-surface-700 bg-surface-900/80 p-4 transition hover:border-gold-500/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-surface-100">{r.title}</h3>
                  <p className="mt-1 text-xs text-surface-500">
                    {r.createdBy?.displayName || '—'} · {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${
                    r.portalActive
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-surface-800 text-surface-400'
                  }`}
                >
                  {r.portalActive ? 'Published' : 'Draft'}
                </span>
              </div>
            </Link>
          ))}
        </div>
        {totalPages > 1 && (
          <div className="mt-4 flex justify-between text-xs text-surface-500">
            <span>
              Página {page}/{totalPages}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-surface-700 px-3 py-1.5 disabled:opacity-30">
                Anterior
              </button>
              <button type="button" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-surface-700 px-3 py-1.5 disabled:opacity-30">
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
