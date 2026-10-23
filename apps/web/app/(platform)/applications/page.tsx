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
  const [viewedFilter, setViewedFilter] = useState(''); // '' | 'viewed' | 'not_viewed' | 'contact' | 'won'
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  function openDetail(id: string) {
    setDetailId(id);
  }

  const load = useCallback(() => {
    setLoading(true);
    applicationsApi
      .list({ ...(filter ? { status: filter } : {}), page, pageSize: 25 })
      .then((d) => {
        let rows = d.data || [];
        if (sourceFilter) {
          rows = rows.filter((a: any) => {
          const s = a.source || (a.assignedToUserTag === 'FREELANCER' ? 'FREELANCER' : 'RADAR');
          return s === sourceFilter;
        });
        }
        if (viewedFilter === 'viewed') {
          rows = rows.filter((a: any) => !!a.clientViewed || ['EN_CONVERSACION','ADJUDICADO_A_MIME','ADJUDICADO_A_OTRO'].includes(a.status));
        } else if (viewedFilter === 'not_viewed') {
          rows = rows.filter((a: any) => !a.clientViewed && a.status === 'POSTULADO');
        } else if (viewedFilter === 'contact') {
          rows = rows.filter((a: any) => a.status === 'EN_CONVERSACION' || (a.messages?.[0]?.sender === 'client'));
        } else if (viewedFilter === 'won') {
          rows = rows.filter((a: any) => a.status === 'ADJUDICADO_A_MIME');
        }
        setApps(rows);
        setTotalPages(d.totalPages || 1);
      })
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }, [filter, sourceFilter, viewedFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => setPage(1), [filter, sourceFilter, viewedFilter]);

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
            Todas las postulaciones · visto, contacto, ganado/sellado y perdido
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
            value={viewedFilter}
            onChange={(e) => setViewedFilter(e.target.value)}
            className="rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-200"
          >
            <option value="">Vistos / contacto</option>
            <option value="viewed">Solo vistos</option>
            <option value="not_viewed">Sin ver</option>
            <option value="contact">Con contacto</option>
            <option value="won">Ganadas</option>
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
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Visto</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Contacto</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> Ganado / sellado</span>
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
            const hasClientMessage = (app._count?.messages ?? 0) > 0 && app.messages?.[0]?.sender === 'client';
            const isWon = app.status === 'ADJUDICADO_A_MIME';
            const isViewed = !!app.clientViewed || hasClientMessage || ['EN_CONVERSACION', 'ADJUDICADO_A_MIME', 'ADJUDICADO_A_OTRO'].includes(app.status);
            const cardTone = isWon
              ? 'border-cyan-400/70 bg-cyan-950/20 hover:border-cyan-300'
              : hasClientMessage
                ? 'border-amber-400/70 bg-amber-950/20 hover:border-amber-300'
                : isViewed
                  ? 'border-emerald-500/60 bg-emerald-950/15 hover:border-emerald-400'
                  : isFl
                    ? 'border-cyan-500/40 hover:border-cyan-400/70'
                    : 'border-surface-700 hover:border-surface-500';
            return (
              <button
                type="button"
                key={app.id}
                onClick={() => openDetail(app.id)}
                className={`w-full text-left block rounded-xl border p-4 transition-all duration-300 hover:-translate-y-0.5 ${cardTone}`}
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
                      {app.clientCountry || '—'} · Oferta ${app.submittedPrice} · {app.submittedDays}d
                      {app.avgBidPrice ? ` · Promedio $${app.avgBidPrice}` : ''}
                      {app.recommendedPrice ? ` · Sugerido $${app.recommendedPrice}` : ''}
                      {app.assignedToUserTag ? ` · ${app.assignedToUserTag}` : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs px-2.5 py-1 rounded-full ${
                      STATUS_COLORS[app.status] || ''
                    }`}
                  >
                      {isWon ? 'Ganado · sellado' : hasClientMessage ? 'Contacto' : isViewed ? 'Visto' : (STATUS_LABELS[app.status] || app.status)}
                  </span>
                </div>
                {app.winnerBidPrice != null && (
                  <p className={`text-xs mt-2 ${isWon ? 'text-cyan-300' : 'text-red-400'}`}>
                    {isWon ? 'Postulación ganada / sellada' : 'Ganador'}: ${app.winnerBidPrice}
                    {app.winnerRating != null ? ` · ★ ${app.winnerRating}` : ''}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
      {!loading && apps.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-surface-800 pt-4 text-xs text-surface-500">
          <span>Página {page} de {totalPages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-surface-700 px-3 py-1.5 disabled:opacity-30 hover:border-gold-500/60">Anterior</button>
            <button type="button" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-surface-700 px-3 py-1.5 disabled:opacity-30 hover:border-gold-500/60">Siguiente</button>
          </div>
        </div>
      )}

      {detailId && (
        <ApplicationModal
          id={detailId}
          onClose={() => {
            setDetailId(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ApplicationModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [app, setApp] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadDetail = () => {
    setLoading(true);
    applicationsApi
      .get(id)
      .then(setApp)
      .catch(() => setApp(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDetail();
  }, [id]);

  async function sendMessage() {
    if (!message.trim()) return;
    setSending(true);
    try {
      await applicationsApi.addMessage(id, message.trim(), 'me');
      setMessage('');
      loadDetail();
    } catch (e: any) {
      alert(e.message || 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-surface-600 bg-surface-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-surface-700 px-5 py-3">
          <div className="min-w-0">
            <p className="text-xs text-surface-500">Postulación</p>
            <h2 className="truncate text-lg font-semibold text-surface-50">
              {app?.title || (loading ? 'Cargando…' : '—')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-surface-400 hover:bg-surface-800 hover:text-surface-100"
          >
            Cerrar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && <p className="text-sm text-surface-500">Cargando detalle…</p>}
          {!loading && !app && <p className="text-sm text-red-400">No se pudo cargar</p>}
          {app && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-surface-800 px-2.5 py-1 text-surface-300">
                  {STATUS_LABELS[app.status] || app.status}
                </span>
                {app.clientCountry && (
                  <span className="rounded-full bg-surface-800 px-2.5 py-1 text-surface-300">
                    🌍 {app.clientCountry}
                  </span>
                )}
                {app.clientViewed && (
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-emerald-300">Visto</span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Metric label="Tu oferta" value={`$${app.submittedPrice}`} />
                <Metric label="Días" value={String(app.submittedDays)} />
                <Metric label="Promedio" value={app.avgBidPrice != null ? `$${app.avgBidPrice}` : '—'} />
                <Metric
                  label="Ganador"
                  value={app.winnerBidPrice != null ? `$${app.winnerBidPrice}` : '—'}
                />
              </div>

              <div className="rounded-xl border border-surface-700 bg-surface-950/50 p-4">
                <h3 className="text-sm font-medium text-surface-300 mb-2">Descripción</h3>
                <p className="text-xs text-surface-400 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {app.translatedDesc || app.rawDescription || '—'}
                </p>
              </div>

              <div className="rounded-xl border border-surface-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-700 text-sm font-medium text-surface-200">
                  Conversación
                </div>
                <div className="p-4 space-y-3 max-h-56 overflow-y-auto">
                  {(app.messages || []).length === 0 && (
                    <p className="text-sm text-surface-500 text-center py-6">Sin mensajes</p>
                  )}
                  {(app.messages || []).map((m: any) => (
                    <div key={m.id} className={`flex ${m.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                          m.sender === 'me' ? 'bg-emerald-600 text-white' : 'bg-surface-800 text-surface-100'
                        }`}
                      >
                        {m.text}
                        <div className={`text-[10px] mt-1 ${m.sender === 'me' ? 'text-emerald-100' : 'text-surface-500'}`}>
                          {new Date(m.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-surface-700 flex gap-2">
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Mensaje…"
                    className="flex-1 rounded-lg border border-surface-700 bg-surface-950 px-3 py-2 text-sm text-surface-100"
                  />
                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={sending || !message.trim()}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm px-4 py-2"
                  >
                    Enviar
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-surface-700 p-4">
                <h3 className="text-sm font-medium text-surface-300 mb-2">Tu propuesta</h3>
                <pre className="text-xs text-surface-400 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {app.proposalText}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-700 bg-surface-950/60 p-3">
      <div className="text-[10px] uppercase tracking-wide text-surface-500">{label}</div>
      <div className="text-base font-semibold text-surface-100 mt-0.5">{value}</div>
    </div>
  );
}
