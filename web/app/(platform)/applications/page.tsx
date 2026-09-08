'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const STATUS_LABELS: Record<string, string> = {
  POSTULADO: 'Postulado',
  EN_CONVERSACION: 'En conversación',
  ADJUDICADO_A_MIME: '¡Ganado!',
  ADJUDICADO_A_OTRO: 'Perdido',
  CANCELADO: 'Cancelado',
  NO_ADJUDICADO: 'No adjudicado',
};

const STATUS_COLORS: Record<string, string> = {
  POSTULADO: 'bg-blue-100 text-blue-800',
  EN_CONVERSACION: 'bg-amber-100 text-amber-800',
  ADJUDICADO_A_MIME: 'bg-emerald-100 text-emerald-800',
  ADJUDICADO_A_OTRO: 'bg-red-100 text-red-800',
  CANCELADO: 'bg-slate-100 text-slate-600',
  NO_ADJUDICADO: 'bg-slate-100 text-slate-600',
};

export default function ApplicationsPage() {
  const [apps, setApps] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = filter ? `?status=${filter}` : '';
    fetch(`/api/applications${q}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setApps(d.data || d || []))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">CRM de Postulaciones</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Todos</option>
          {Object.keys(STATUS_LABELS).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-slate-400">Cargando…</p>
      ) : apps.length === 0 ? (
        <p className="text-slate-400 bg-slate-50 rounded-lg p-8 text-center">
          No hay postulaciones todavía. Usá el Radar para encontrar proyectos.
        </p>
      ) : (
        <div className="space-y-3">
          {apps.map((app) => (
            <Link
              key={app.id}
              href={`/applications/${app.id}`}
              className="block bg-white border rounded-xl p-4 hover:border-emerald-300 hover:shadow-sm transition"
            >
              <div className="flex justify-between items-start gap-3">
                <div>
                  <h3 className="font-medium">{app.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {app.clientCountry || '—'} · ${app.submittedPrice} · {app.submittedDays} días
                    {app.assignedToUserTag && ` · ${app.assignedToUserTag}`}
                  </p>
                </div>
                <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[app.status] || 'bg-slate-100'}`}>
                  {STATUS_LABELS[app.status] || app.status}
                </span>
              </div>
              {app.winnerBidPrice && (
                <p className="text-xs text-red-600 mt-2">
                  Ganador: ${app.winnerBidPrice}
                  {app.winnerRating != null && ` · ★ ${app.winnerRating}`}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
