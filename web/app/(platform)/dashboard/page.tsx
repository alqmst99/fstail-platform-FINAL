'use client';

import { useEffect, useState, useCallback } from 'react';
import { QuickBidCard } from '@/components/radar/QuickBidCard';

type UserTag = 'Dev1' | 'Dev2';

interface Task {
  id: string;
  title: string;
  category: string;
  completed: boolean;
  timeSpentMin: number;
  energyLevel?: number | null;
}

interface Application {
  id: string;
  title: string;
  status: string;
  submittedPrice: number;
  updatedAt: string;
  _count?: { messages: number };
}

export default function DashboardPage() {
  const [userTag, setUserTag] = useState<UserTag>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('userTag') as UserTag) || 'Dev1';
    }
    return 'Dev1';
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [energy, setEnergy] = useState(3);
  const [activeApps, setActiveApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [tasksRes, appsRes] = await Promise.all([
        fetch(`/api/daily-tasks?userTag=${userTag}&date=${today}`, { credentials: 'include' }),
        fetch(`/api/applications?status=POSTULADO,EN_CONVERSACION&assignedTo=${userTag}`, {
          credentials: 'include',
        }),
      ]);

      if (tasksRes.ok) {
        const t = await tasksRes.json();
        setTasks(Array.isArray(t) ? t : t.data || []);
        const latestEnergy = (Array.isArray(t) ? t : t.data || [])
          .filter((x: Task) => x.energyLevel != null)
          .pop()?.energyLevel;
        if (latestEnergy) setEnergy(latestEnergy);
      }

      if (appsRes.ok) {
        const a = await appsRes.json();
        setActiveApps(a.data || a || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userTag]);

  useEffect(() => {
    localStorage.setItem('userTag', userTag);
    loadData();
  }, [userTag, loadData]);

  const copyRoutinePrompt = async () => {
    try {
      const res = await fetch(`/api/daily-tasks/routine-context?userTag=${userTag}`, {
        credentials: 'include',
      });
      const ctx = res.ok ? await res.json() : {
        userTag,
        energyLevel: energy,
        pendingTasks: tasks.filter((t) => !t.completed),
        activeChats: activeApps.length,
        conversionRate: 'N/A',
        date: new Date().toISOString().slice(0, 10),
      };

      const prompt = `Eres mi coach operativo de freelancing. Genera mi rutina diaria optimizada basándote en este contexto JSON:

${JSON.stringify(ctx, null, 2)}

Prioriza:
1) Mensajes calientes / conversaciones activas
2) Postulaciones de alta calidad pendientes
3) Estudio o práctica si energía baja
4) Descanso real si energy ≤ 2

Responde con bloques de tiempo concretos y una frase motivacional corta.`;

      await navigator.clipboard.writeText(prompt);
      alert('✅ Prompt de rutina copiado. Pégalo en ChatGPT, Claude o Grok.');
    } catch {
      alert('Error al copiar el prompt');
    }
  };

  const toggleTask = async (id: string, completed: boolean) => {
    await fetch(`/api/daily-tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ completed: !completed }),
    });
    loadData();
  };

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      {/* Header multi-tag */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Operativo</h1>
          <p className="text-sm text-slate-500">Radar · CRM · Salud operativa</p>
        </div>
        <select
          value={userTag}
          onChange={(e) => setUserTag(e.target.value as UserTag)}
          className="border rounded-lg px-3 py-2 bg-white shadow-sm"
        >
          <option value="Dev1">Dev1</option>
          <option value="Dev2">Dev2</option>
        </select>
      </div>

      {/* Salud operativa + Prompt Hub */}
      <div className="bg-white border rounded-xl p-5 flex flex-wrap items-center gap-6 shadow-sm">
        <div>
          <label className="text-sm font-medium text-slate-700">Nivel de Energía (1-5)</label>
          <div className="flex gap-2 mt-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setEnergy(n)}
                className={`w-10 h-10 rounded-full border text-sm font-medium transition ${
                  energy === n
                    ? 'bg-amber-400 border-amber-500 text-amber-900 scale-110'
                    : 'bg-slate-50 hover:bg-slate-100'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={copyRoutinePrompt}
          className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm"
        >
          Copiar Prompt de Rutina
        </button>
      </div>

      {/* Tareas del día */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">Tareas de hoy</h2>
          <span className="text-xs text-slate-500">{tasks.filter((t) => !t.completed).length} pendientes</span>
        </div>
        {loading ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-slate-400 bg-slate-50 rounded-lg p-4">No hay tareas para hoy. ¡Agregá algunas!</p>
        ) : (
          <div className="grid gap-2">
            {tasks.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 bg-white border rounded-lg p-3 shadow-sm hover:border-slate-300 transition"
              >
                <input
                  type="checkbox"
                  checked={t.completed}
                  onChange={() => toggleTask(t.id, t.completed)}
                  className="w-4 h-4 rounded"
                />
                <span className={t.completed ? 'line-through text-slate-400 flex-1' : 'flex-1'}>
                  {t.title}
                </span>
                <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{t.category}</span>
                <span className="text-xs text-slate-500 w-14 text-right">{t.timeSpentMin} min</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Postulaciones activas */}
      <section>
        <h2 className="font-semibold text-lg mb-3">Postulaciones activas</h2>
        {activeApps.length === 0 ? (
          <p className="text-sm text-slate-400 bg-slate-50 rounded-lg p-4">Ninguna postulación en curso.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {activeApps.map((app) => (
              <a
                key={app.id}
                href={`/applications/${app.id}`}
                className="block bg-white border rounded-lg p-4 hover:border-emerald-300 hover:shadow-sm transition"
              >
                <div className="flex justify-between items-start gap-2">
                  <h3 className="font-medium text-sm line-clamp-2">{app.title}</h3>
                  <span className="shrink-0 text-xs px-2 py-0.5 rounded bg-slate-100">{app.status}</span>
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-500">
                  <span>${app.submittedPrice}</span>
                  <span>{app._count?.messages ?? 0} msgs</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
