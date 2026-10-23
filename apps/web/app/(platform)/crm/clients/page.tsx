'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { clientsApi, type Client, type ClientStats } from '../../../../lib/crm-api';

const STATUS_LABEL: Record<string, string> = {
  LEAD: 'Lead',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  ARCHIVED: 'Archived',
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, st] = await Promise.all([
        clientsApi.list({
          page,
          pageSize: 25,
          ...(search ? { search } : {}),
          ...(status ? { status: status as any } : {}),
        }),
        clientsApi.stats(),
      ]);
      setClients(list.data || []);
      setTotalPages(list.totalPages || 1);
      setStats(st);
    } catch (e: any) {
      setError(e.message || 'No se pudieron cargar los clientes');
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => setPage(1), [search, status]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-700 px-4 py-4 sm:px-6">
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

      <div className="flex flex-wrap gap-2 border-b border-surface-700 px-4 py-3 sm:px-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar…"
          className="w-full max-w-xs rounded-md border border-surface-600 bg-surface-900 px-3 py-1.5 text-sm text-surface-50 placeholder-surface-500 outline-none focus:border-gold-500"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-surface-600 bg-surface-900 px-3 py-1.5 text-sm text-surface-50"
        >
          <option value="">Todos</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {loading && <p className="text-sm text-surface-500">Cargando…</p>}
        {error && (
          <p className="mb-3 rounded-md border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        {!loading && !error && clients.length === 0 && (
          <div className="rounded-xl border border-surface-700 bg-surface-900 p-10 text-center">
            <p className="text-sm text-surface-400">No hay clientes todavía.</p>
            <Link href="/crm/clients/new" className="mt-3 inline-block text-sm text-gold-400 hover:text-gold-300">
              Crear el primero →
            </Link>
          </div>
        )}
        <div className="space-y-2">
          {clients.map((c) => (
            <Link
              key={c.id}
              href={`/crm/clients/${c.id}`}
              className="block rounded-xl border border-surface-700 bg-surface-900/80 p-4 transition hover:border-gold-500/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-surface-100">{c.name}</h3>
                  <p className="mt-1 text-xs text-surface-500">
                    {c.email || '—'} · {c._count?.projects ?? 0} proyectos · {c._count?.audits ?? 0} audits
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-surface-800 px-2.5 py-1 text-xs text-surface-300">
                  {STATUS_LABEL[c.status] || c.status}
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
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-surface-700 px-3 py-1.5 disabled:opacity-30"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-surface-700 px-3 py-1.5 disabled:opacity-30"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
