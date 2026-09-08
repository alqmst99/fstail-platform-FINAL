
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { applicationsApi } from '../../../../lib/applications-api';

type Outcome = 'WON' | 'LOST' | 'PENDING' | 'RETRACTED' | 'UNKNOWN';

export default function ApplicationsAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [outcomeFilter, setOutcomeFilter] = useState<string>('');
  const [q, setQ] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const hist = await applicationsApi.freelancerHistory(true);
      setData(hist);
    } catch (e: any) {
      setError(
        e.message ||
          'No se pudo leer el historial de Freelancer. Revisá OAuth (ACCESS_TOKEN + USER_ID) y que la app esté Approved.',
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const bids: any[] = data?.bids || [];

  const filtered = useMemo(() => {
    return bids.filter((b) => {
      if (outcomeFilter && b.outcome !== outcomeFilter) return false;
      if (q.trim()) {
        const hay = `${b.projectTitle} ${b.projectId}`.toLowerCase();
        if (!hay.includes(q.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [bids, outcomeFilter, q]);

  if (loading) {
    return (
      <div className="p-6 text-surface-400 text-sm">
        Trayendo tu historial de bids desde Freelancer API…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/applications" className="text-xs text-surface-500 hover:text-gold-400">
            ← Postulaciones locales
          </Link>
          <h1 className="text-2xl font-bold text-surface-50 mt-1">Historial Freelancer</h1>
          <p className="text-sm text-surface-400 mt-1">
            Freelancer API → Prisma cache · {data?.source || '—'}
            {data?.lastSyncedAt
              ? ` · sync ${new Date(data.lastSyncedAt).toLocaleString()}`
              : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-200 hover:border-gold-500/40"
        >
          Refrescar desde API
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Total bids (API)" value={data.total} />
            <Kpi
              label="Adjudicadas a vos"
              value={data.awarded}
              sub={`${data.conversionRate}% conversión`}
              accent="text-emerald-400"
            />
            <Kpi label="Perdidas / no ganadas" value={data.lost} accent="text-red-400" />
            <Kpi
              label="Vistas por cliente"
              value={data.viewed}
              sub={
                data.total
                  ? `${data.viewRate}% · perfil ${data.profileVisited}`
                  : 'si la API expone el flag'
              }
              accent="text-blue-300"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Kpi label="Pendientes" value={data.pending} />
            <Kpi label="Retiradas" value={data.retracted} />
            <Kpi
              label="Avg tu $ (pérdidas)"
              value={data.avgOurWhenLost != null ? `$${data.avgOurWhenLost}` : '—'}
            />
            <Kpi
              label="Avg ganador (pérdidas)"
              value={data.avgWinnerWhenLost != null ? `$${data.avgWinnerWhenLost}` : '—'}
            />
          </div>

          {(data.insights || []).length > 0 && (
            <div className="rounded-2xl border border-gold-500/30 bg-surface-900 p-5 space-y-2">
              <h2 className="text-sm font-semibold text-gold-500">Insights</h2>
              <ul className="space-y-2">
                {data.insights.map((line: string, i: number) => (
                  <li key={i} className="text-sm text-surface-300 flex gap-2">
                    <span className="text-gold-500">→</span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Price gaps when lost */}
          {(data.priceGaps || []).length > 0 && (
            <div className="rounded-2xl border border-surface-700 bg-surface-900 overflow-hidden">
              <div className="px-5 py-3 border-b border-surface-700">
                <h2 className="text-sm font-semibold text-surface-200">
                  Pérdidas con precio del ganador (API)
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-surface-500 border-b border-surface-800">
                    <tr>
                      <th className="px-4 py-2">Proyecto</th>
                      <th className="px-4 py-2">Tu $</th>
                      <th className="px-4 py-2">Ganador $</th>
                      <th className="px-4 py-2">Δ</th>
                      <th className="px-4 py-2">Δ%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.priceGaps.map((g: any) => (
                      <tr key={g.projectId} className="border-b border-surface-800/80">
                        <td className="px-4 py-2 text-surface-200">
                          {g.seoUrl ? (
                            <a
                              href={`https://www.freelancer.com/projects/${g.seoUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-gold-400"
                            >
                              {g.title}
                            </a>
                          ) : (
                            g.title
                          )}
                        </td>
                        <td className="px-4 py-2">${g.yourAmount}</td>
                        <td className="px-4 py-2">${g.winnerAmount}</td>
                        <td
                          className={`px-4 py-2 ${
                            g.delta > 0 ? 'text-red-400' : g.delta < 0 ? 'text-emerald-400' : ''
                          }`}
                        >
                          {g.delta > 0 ? '+' : ''}
                          {g.delta}
                        </td>
                        <td className="px-4 py-2 text-surface-400">
                          {g.deltaPct != null ? `${g.deltaPct}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Full bid list */}
          <div className="rounded-2xl border border-surface-700 bg-surface-900 overflow-hidden">
            <div className="px-5 py-3 border-b border-surface-700 flex flex-wrap gap-3 items-center justify-between">
              <h2 className="text-sm font-semibold text-surface-200">
                Todas tus postulaciones ({filtered.length}/{bids.length})
              </h2>
              <div className="flex gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar título…"
                  className="rounded-lg border border-surface-700 bg-surface-950 px-3 py-1.5 text-xs text-surface-200"
                />
                <select
                  value={outcomeFilter}
                  onChange={(e) => setOutcomeFilter(e.target.value)}
                  className="rounded-lg border border-surface-700 bg-surface-950 px-2 py-1.5 text-xs text-surface-200"
                >
                  <option value="">Todos</option>
                  <option value="WON">Ganadas</option>
                  <option value="LOST">Perdidas</option>
                  <option value="PENDING">Pendientes</option>
                  <option value="RETRACTED">Retiradas</option>
                </select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="p-8 text-center text-sm text-surface-500">Sin bids para este filtro</p>
            ) : (
              <div className="divide-y divide-surface-800 max-h-[32rem] overflow-y-auto">
                {filtered.map((b) => (
                  <div key={b.bidId} className="px-4 py-3 hover:bg-surface-800/40 flex flex-wrap gap-3 justify-between">
                    <div className="min-w-0 flex-1">
                      <a
                        href={
                          b.seoUrl
                            ? `https://www.freelancer.com/projects/${b.seoUrl}`
                            : `https://www.freelancer.com/projects/${b.projectId}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-surface-100 hover:text-gold-400 line-clamp-1"
                      >
                        {b.projectTitle}
                      </a>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-surface-500">
                        <span>
                          ${b.amount} · {b.period}d
                        </span>
                        {b.submittedAt && (
                          <span>{new Date(b.submittedAt).toLocaleDateString()}</span>
                        )}
                        {b.bidCount != null && <span>{b.bidCount} bids en el proyecto</span>}
                        {b.clientViewed && (
                          <span className="text-blue-300">👁 visto</span>
                        )}
                        {b.profileViewed && (
                          <span className="text-blue-300">👤 perfil</span>
                        )}
                      </div>
                    </div>
                    <OutcomeBadge outcome={b.outcome as Outcome} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-surface-700 bg-surface-900 p-5">
      <div className="text-xs text-surface-400">{label}</div>
      <div className={`text-3xl font-semibold mt-2 ${accent || 'text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-surface-500 mt-1">{sub}</div>}
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const map: Record<Outcome, string> = {
    WON: 'bg-emerald-500/20 text-emerald-300',
    LOST: 'bg-red-500/20 text-red-300',
    PENDING: 'bg-amber-500/20 text-amber-300',
    RETRACTED: 'bg-surface-700 text-surface-400',
    UNKNOWN: 'bg-surface-700 text-surface-500',
  };
  const label: Record<Outcome, string> = {
    WON: 'Ganada',
    LOST: 'Perdida',
    PENDING: 'Pendiente',
    RETRACTED: 'Retirada',
    UNKNOWN: '?',
  };
  return (
    <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full ${map[outcome] || map.UNKNOWN}`}>
      {label[outcome] || outcome}
    </span>
  );
}
