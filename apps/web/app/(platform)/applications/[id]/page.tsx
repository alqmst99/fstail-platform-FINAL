
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { applicationsApi } from '../../../../lib/applications-api';

export default function ApplicationDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [app, setApp] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = () => {
    if (!id) return;
    applicationsApi.get(id).then(setApp).catch(() => setApp(null));
  };

  useEffect(() => {
    load();
  }, [id]);

  async function sendMessage() {
    if (!message.trim()) return;
    setSending(true);
    try {
      await applicationsApi.addMessage(id, message, 'me');
      setMessage('');
      load();
    } finally {
      setSending(false);
    }
  }

  if (!app) {
    return <div className="p-6 text-surface-400 text-sm">Cargando…</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Link href="/applications" className="text-xs text-surface-500 hover:text-gold-400">
        ← Postulaciones
      </Link>
      <div>
        <h1 className="text-xl font-bold text-surface-50">{app.title}</h1>
        <p className="text-sm text-surface-400 mt-1">
          {app.status} · ${app.submittedPrice} · {app.submittedDays} días
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Metric label="Precio medio" value={app.avgBidPrice != null ? `$${app.avgBidPrice}` : '—'} />
        <Metric label="Precio sugerido" value={app.recommendedPrice != null ? `$${app.recommendedPrice}` : '—'} />
        <Metric label="Precio enviado" value={`$${app.submittedPrice}`} />
      </div>

      <div className="rounded-xl border border-surface-700 bg-surface-900 p-4">
        <h2 className="text-sm font-medium text-surface-300 mb-2">Descripción original del proyecto</h2>
        <p className="text-sm text-surface-400 whitespace-pre-wrap max-h-80 overflow-y-auto">
          {app.rawDescription || 'No hay descripción original guardada.'}
        </p>
      </div>

      <div className="rounded-xl border border-surface-700 bg-surface-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-700 text-sm font-medium text-surface-200">
          Conversación
        </div>
        <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
          {(app.messages || []).length === 0 && (
            <p className="text-sm text-surface-500 text-center py-8">Sin mensajes</p>
          )}
          {(app.messages || []).map((m: any) => (
            <div key={m.id} className={`flex ${m.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  m.sender === 'me'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-surface-800 text-surface-100'
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

      <div className="rounded-xl border border-surface-700 bg-surface-900 p-4">
        <h3 className="text-sm font-medium text-surface-300 mb-2">Tu propuesta</h3>
        <pre className="text-xs text-surface-400 whitespace-pre-wrap">{app.proposalText}</pre>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-700 bg-surface-900 p-4">
      <div className="text-xs text-surface-500">{label}</div>
      <div className="text-lg font-semibold text-surface-100 mt-1">{value}</div>
    </div>
  );
}
