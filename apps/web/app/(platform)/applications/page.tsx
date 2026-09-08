'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { applicationsApi } from '../../../lib/applications-api';

const STATUS_LABELS: Record<string, string> = {
  POSTULADO: 'Postulado',
  EN_CONVERSACION: 'En conversación',
  ADJUDICADO_A_MIME: 'Ganado',
  ADJUDICADO_A_OTRO: 'Perdido',
  CANCELADO: 'Cancelado',
  NO_ADJUDICADO: 'No adjudicado',
};

const STATUS_COLORS: Record<string, string> = {
  POSTULADO: 'bg-blue-500/20 text-blue-300',
  EN_CONVERSACION: 'bg-amber-500/20 text-amber-300',
  ADJUDICADO_A_MIME: 'bg-emerald-500/20 text-emerald-300',
  ADJUDICADO_A_OTRO: 'bg-red-500/20 text-red-300',
  CANCELADO: 'bg-surface-700 text-surface-400',
  NO_ADJUDICADO: 'bg-surface-700 text-surface-400',
};

export default function ApplicationsPage() {
  const [apps, setApps] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    applicationsApi
      .list(filter ? { status: filter } : undefined)
      .then((d) => {
        let rows = d.data || [];
        if (sourceFilter) {
          rows = rows.filter((a: any) => {
          const s = a.source || (a.assignedToUserTag === 'FREELANCER' ? 'FREELANCER' : 'RADAR');
          return s === sourceFilter;
        });
        }
        setApps(rows);
      })
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }, [filter, sourceFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await applicationsApi.syncFreelancer();
      setSyncMsg(
        `Importados ${res.imported} (API ${res.totalRaw}) · Ganados ${res.won} · Perdidos ${res.lost} · Pendientes ${res.pending}`,
      );
      load();
    } catch (e: any) {
      setSyncMsg(e.message || 'Error al sincronizar');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Postulaciones</h1>
          <p className="text-sm text-surface-400 mt-1">
            Radar (verde) + Freelancer API (celeste) · estados reales
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium px-3 py-2"
          >
            {syncing ? 'Sincronizando…' : '↻ Sync Freelancer'}
          </button>
          <Link
            href="/applications/analytics"
            className="rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-gold-500 hover:border-gold-500/50"
          >
            Análisis →
          </Link>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-200"
          >
            <option value="">Todas las fuentes</option>
            <option value="RADAR">Solo Radar</option>
            <option value="FREELANCER">Solo Freelancer</option>
          </select>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-200"
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {syncMsg && (
        <p className="text-xs text-cyan-300/90 bg-cyan-950/40 border border-cyan-800/50 rounded-lg px-3 py-2">
          {syncMsg}
        </p>
      )}

      <div className="flex gap-3 text-[11px] text-surface-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Radar
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> Freelancer (API)
        </span>
      </div>

      {loading ? (
        <p className="text-surface-500 text-sm">Cargando…</p>
      ) : apps.length === 0 ? (
        <div className="rounded-2xl border border-surface-700 bg-surface-900 p-12 text-center space-y-3">
          <p className="text-surface-400 text-sm">No hay postulaciones todavía.</p>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="text-sm text-cyan-400 hover:text-cyan-300"
          >
            Sincronizar desde Freelancer →
          </button>
          <div>
            <Link href="/radar" className="inline-block text-gold-500 text-sm hover:text-gold-400">
              Ir al Radar →
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {apps.map((app) => {
            const src = app.source || (app.assignedToUserTag === 'FREELANCER' ? 'FREELANCER' : 'RADAR');
            const isFl = src === 'FREELANCER';
            return (
              <Link
                key={app.id}
                href={`/applications/${app.id}`}
                className={`block rounded-xl border bg-surface-900 p-4 transition ${
                  isFl
                    ? 'border-cyan-500/40 hover:border-cyan-400/70'
                    : 'border-emerald-500/30 hover:border-emerald-400/60'
                }`}
              >
                <div className="flex justify-between gap-3 items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
                          isFl ? 'bg-cyan-500/20 text-cyan-300' : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {isFl ? 'Freelancer' : 'Radar'}
                      </span>
                    </div>
                    <h3 className="font-medium text-surface-100">{app.title}</h3>
                    <p className="text-xs text-surface-500 mt-1">
                      {app.clientCountry || '—'} · ${app.submittedPrice} · {app.submittedDays}d
                      {app.assignedToUserTag ? ` · ${app.assignedToUserTag}` : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs px-2.5 py-1 rounded-full ${
                      STATUS_COLORS[app.status] || ''
                    }`}
                  >
                    {STATUS_LABELS[app.status] || app.status}
                  </span>
                </div>
                {app.winnerBidPrice != null && (
                  <p className="text-xs text-red-400 mt-2">
                    Ganador: ${app.winnerBidPrice}
                    {app.winnerRating != null ? ` · ★ ${app.winnerRating}` : ''}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
