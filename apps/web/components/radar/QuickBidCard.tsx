'use client';

import { useState } from 'react';

interface Project {
  id: number;
  title: string;
  description: string;
  bidCount: number;
  avgBid?: number;
  paymentVerified?: boolean;
  hireRate?: number;
  reviewsCount?: number;
  clientCountry?: string;
  budget?: { minimum: number; maximum: number };
  attachmentsText?: string;
}

interface Props {
  project: Project;
  onSubmitted?: (applicationId: string) => void;
}

export function QuickBidCard({ project, onSubmitted }: Props) {
  const avgBid = project.avgBid ?? 0;
  const recommended = avgBid > 0 ? Math.round(avgBid * 0.92) : Math.round((project.budget?.minimum ?? 50) * 0.9);

  const [proposal, setProposal] = useState(
    `Hola! Revisé tu proyecto "${project.title}" y tengo experiencia directa en este stack.\n\nPuedo entregarte una solución limpia, documentada y lista para producción. Portfolio relevante: https://tu-portfolio.com\n\n¿Te parece si arrancamos con una llamada rápida de 10 min?`
  );
  const [price, setPrice] = useState(recommended);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Evaluación local rápida (el backend ya filtró, pero mostramos motivos si falla)
  const qualified =
    project.paymentVerified !== false &&
    ((project.reviewsCount ?? 0) === 0 || (project.hireRate ?? 1) >= 0.6) &&
    (project.description?.length ?? 0) >= 120 &&
    (project.bidCount ?? 0) <= 15;

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Proxy al backend que hace el POST real a Freelancer + guarda Application
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          freelancerProjId: String(project.id),
          title: project.title,
          rawDescription: project.description,
          avgBidPrice: avgBid,
          recommendedPrice: recommended,
          submittedPrice: price,
          submittedDays: days,
          proposalText: proposal,
          attachmentsText: project.attachmentsText,
          assignedToUserTag: localStorage.getItem('userTag') || 'Dev1',
          clientCountry: project.clientCountry,
          clientHireRate: project.hireRate,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Error al postular');
      }

      const app = await res.json();

      // Notificación nativa vía Electron preload
      if (typeof window !== 'undefined' && (window as any).electronAPI?.notify) {
        (window as any).electronAPI.notify({
          title: 'Postulación enviada',
          body: `"${project.title}" — $${price}`,
          applicationId: app.id,
        });
      }

      onSubmitted?.(app.id);
    } catch (e: any) {
      setError(e.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-xl p-5 bg-white shadow-sm space-y-4 max-w-2xl">
      <div className="flex justify-between items-start gap-3">
        <h3 className="font-semibold text-lg leading-tight">{project.title}</h3>
        <span
          className={`shrink-0 px-2 py-1 rounded text-xs font-medium ${
            qualified ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {qualified ? 'Calificado' : 'Revisar'}
        </span>
      </div>

      {/* Cuadro de precios */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-slate-50 p-3 rounded-lg">
          <div className="text-xs text-slate-500">Promedio mercado</div>
          <div className="font-bold text-lg">${avgBid || '—'}</div>
        </div>
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-xs text-blue-600">Recomendado</div>
          <div className="font-bold text-lg text-blue-700">${recommended}</div>
        </div>
        <div className="bg-emerald-50 p-3 rounded-lg">
          <div className="text-xs text-emerald-600">Tu oferta</div>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="w-full text-center font-bold text-lg border-0 bg-transparent focus:outline-none"
          />
        </div>
      </div>

      {/* Descripción */}
      <div>
        <button
          type="button"
          onClick={() => setShowOriginal(!showOriginal)}
          className="text-sm text-blue-600 mb-2 hover:underline"
        >
          {showOriginal ? 'Ver resumen' : 'Ver original'}
        </button>
        <div className="text-sm bg-slate-50 p-3 rounded-lg max-h-40 overflow-y-auto whitespace-pre-wrap">
          {showOriginal
            ? project.description
            : (project.description?.slice(0, 450) || '') + (project.description?.length > 450 ? '…' : '')}
          {project.attachmentsText && (
            <div className="mt-2 pt-2 border-t text-xs text-slate-600">
              <strong>Adjuntos:</strong> {project.attachmentsText.slice(0, 280)}…
            </div>
          )}
        </div>
      </div>

      {/* Proposal */}
      <div>
        <label className="text-sm font-medium">Borrador de propuesta</label>
        <textarea
          value={proposal}
          onChange={(e) => setProposal(e.target.value)}
          rows={5}
          className="w-full mt-1 border rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600">Días</label>
          <input
            type="number"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-16 border rounded px-2 py-1 text-sm"
            min={1}
          />
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="ml-auto bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium transition"
        >
          {loading ? 'Enviando…' : 'Postular y Mandar'}
        </button>
      </div>
    </div>
  );
}
