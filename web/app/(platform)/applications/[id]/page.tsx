'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function ApplicationDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [app, setApp] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = () => {
    fetch(`/api/applications/${id}`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setApp);
  };

  useEffect(() => {
    if (id) load();
  }, [id]);

  const sendMessage = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/applications/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: message, sender: 'me' }),
      });
      setMessage('');
      load();
    } finally {
      setSending(false);
    }
  };

  if (!app) return <div className="p-6">Cargando…</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">{app.title}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Estado: <strong>{app.status}</strong> · ${app.submittedPrice} · {app.submittedDays} días
        </p>
      </div>

      {/* Chat */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="p-4 border-b bg-slate-50 font-medium text-sm">Conversación</div>
        <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
          {(app.messages || []).length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">Sin mensajes todavía</p>
          )}
          {(app.messages || []).map((m: any) => (
            <div
              key={m.id}
              className={`flex ${m.sender === 'me' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  m.sender === 'me'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                {m.text}
                <div className={`text-[10px] mt-1 ${m.sender === 'me' ? 'text-emerald-100' : 'text-slate-400'}`}>
                  {new Date(m.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t flex gap-2">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Escribí un mensaje…"
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={sendMessage}
            disabled={sending || !message.trim()}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
      </div>

      {/* Propuesta original */}
      <div className="bg-slate-50 rounded-xl p-4">
        <h3 className="text-sm font-medium mb-2">Tu propuesta</h3>
        <pre className="text-sm whitespace-pre-wrap text-slate-700">{app.proposalText}</pre>
      </div>
    </div>
  );
}
