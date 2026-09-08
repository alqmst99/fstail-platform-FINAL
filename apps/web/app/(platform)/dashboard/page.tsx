'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { applicationsApi, dailyTasksApi } from '../../../lib/applications-api';

type UserTag = 'Dev1' | 'Dev2';

interface Task {
  id: string;
  title: string;
  category: string;
  completed: boolean;
  timeSpentMin: number;
  energyLevel?: number | null;
  notes?: string | null;
  date?: string;
}

interface AppRow {
  id: string;
  title: string;
  status: string;
  submittedPrice: number;
  assignedToUserTag?: string | null;
  _count?: { messages: number };
  updatedAt: string;
}

const CATEGORIES = ['POSTULACION', 'ESTUDIO', 'DESARROLLO', 'SALUD_MENTAL'] as const;

const STATUS_STYLE: Record<string, string> = {
  POSTULADO: 'bg-blue-500/20 text-blue-300',
  EN_CONVERSACION: 'bg-amber-500/20 text-amber-300',
  ADJUDICADO_A_MIME: 'bg-emerald-500/20 text-emerald-300',
  ADJUDICADO_A_OTRO: 'bg-red-500/20 text-red-300',
  CANCELADO: 'bg-surface-700 text-surface-400',
  NO_ADJUDICADO: 'bg-surface-700 text-surface-400',
};

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default function DashboardPage() {
  const [userTag, setUserTag] = useState<UserTag>('Dev1');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [weekTasks, setWeekTasks] = useState<Record<string, Task[]>>({});
  const [monthStats, setMonthStats] = useState<Record<string, { done: number; total: number; energy: number }>>({});
  const [apps, setApps] = useState<AppRow[]>([]);
  const [energy, setEnergy] = useState(3);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(() => toISODate(new Date()));
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<string>('POSTULACION');
  const [adding, setAdding] = useState(false);
  const [routineText, setRoutineText] = useState('');
  const [importing, setImporting] = useState(false);
  const [replaceToday, setReplaceToday] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()));

  useEffect(() => {
    const saved = localStorage.getItem('userTag') as UserTag | null;
    if (saved === 'Dev1' || saved === 'Dev2') setUserTag(saved);
  }, []);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekAnchor, i);
      return { date: toISODate(d), label: DAY_NAMES[i], dayNum: d.getDate() };
    });
  }, [weekAnchor]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Cargar día seleccionado + semana en paralelo (máx 8 requests ligeras)
      const from = weekDays[0]?.date;
      const to = weekDays[6]?.date;
      const [rangeList, a] = await Promise.all([
        (dailyTasksApi as any).listRange
          ? (dailyTasksApi as any).listRange(userTag, from, to).catch(() => [])
          : Promise.all(
              weekDays.map((d) => dailyTasksApi.list(userTag, d.date).catch(() => [] as Task[])),
            ).then((lists: Task[][]) => lists.flat()),
        applicationsApi
          .list({ status: 'POSTULADO,EN_CONVERSACION', assignedTo: userTag })
          .catch(() => ({ data: [] })),
      ]);

      const byDay: Record<string, Task[]> = {};
      weekDays.forEach((d) => {
        byDay[d.date] = [];
      });
      const flat = Array.isArray(rangeList) ? rangeList : [];
      // si vino como arrays por día (fallback viejo)
      if (flat.length && Array.isArray(flat[0]) === false) {
        for (const task of flat as Task[]) {
          const key = (task.date || '').toString().slice(0, 10);
          if (!byDay[key]) byDay[key] = [];
          byDay[key].push(task);
        }
      } else if (Array.isArray(rangeList) && rangeList.length && Array.isArray(rangeList[0])) {
        weekDays.forEach((d, i) => {
          byDay[d.date] = (rangeList as any)[i] || [];
        });
      }
      setWeekTasks(byDay);
      setTasks(byDay[selectedDay] || []);
      setApps(a.data || []);

      const withEnergy = (byDay[selectedDay] || []).filter(
        (x): x is Task & { energyLevel: number } => typeof x.energyLevel === 'number',
      );
      const lastEnergy = withEnergy.at(-1);
      if (lastEnergy) setEnergy(lastEnergy.energyLevel);

      // Mapa mensual simple a partir de la semana actual + mock de densidad
      const month: Record<string, { done: number; total: number; energy: number }> = {};
      for (const [date, list] of Object.entries(byDay)) {
        const total = list.length;
        const done = list.filter((t) => t.completed).length;
        const energies = list
          .map((t) => t.energyLevel)
          .filter((n): n is number => typeof n === 'number');
        const avgE = energies.length ? energies.reduce((s, n) => s + n, 0) / energies.length : 0;
        month[date] = { done, total, energy: avgE };
      }
      setMonthStats(month);
    } finally {
      setLoading(false);
    }
  }, [userTag, weekDays, selectedDay]);

  useEffect(() => {
    localStorage.setItem('userTag', userTag);
    load();
  }, [userTag, load]);

  useEffect(() => {
    setTasks(weekTasks[selectedDay] || []);
  }, [selectedDay, weekTasks]);

  async function addTask() {
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      await dailyTasksApi.create({
        userTag,
        title: newTitle.trim(),
        category: newCategory,
        energyLevel: energy,
        date: selectedDay,
      });
      setNewTitle('');
      await load();
    } catch (e: any) {
      alert(e.message || 'Error al crear tarea');
    } finally {
      setAdding(false);
    }
  }

  async function toggleTask(t: Task) {
    await dailyTasksApi.update(t.id, { completed: !t.completed });
    await load();
  }

  async function saveEnergy(n: number) {
    setEnergy(n);
    try {
      await dailyTasksApi.create({
        userTag,
        title: `Check-in energía: ${n}/5`,
        category: 'SALUD_MENTAL',
        energyLevel: n,
        timeSpentMin: 0,
        date: selectedDay,
      });
      await load();
    } catch {
      /* ignore */
    }
  }

  async function copyRoutinePrompt() {
    try {
      const ctx = await dailyTasksApi.routineContext(userTag).catch(() => ({
        userTag,
        energyLevel: energy,
        pendingTasks: tasks.filter((t) => !t.completed),
        activeChats: apps.length,
        conversionRate: 'N/A',
        date: selectedDay,
      }));
      const prompt = `Eres mi coach operativo de freelancing. Generá mi rutina diaria optimizada con este contexto:

${JSON.stringify(ctx, null, 2)}

Prioridades:
1) Mensajes / conversaciones activas
2) Postulaciones de calidad pendientes
3) Estudio si energía media
4) Descanso real si energy ≤ 2

Respondé con bloques de horario concretos y una frase motivacional corta.`;
      await navigator.clipboard.writeText(prompt);
      alert('Prompt de rutina copiado. Pegalo en ChatGPT / Claude / Grok.');
    } catch {
      alert('No se pudo copiar');
    }
  }

  function parseRoutineText(raw: string): Array<{ title: string; category?: string; timeSpentMin?: number }> {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((t: any) =>
          typeof t === 'string'
            ? { title: t, category: 'DESARROLLO' }
            : {
                title: t.title || t.name || String(t),
                category: t.category || 'DESARROLLO',
                timeSpentMin: t.timeSpentMin || t.minutes || t.duration,
              },
        );
      }
      if (parsed.tasks && Array.isArray(parsed.tasks)) {
        return parseRoutineText(JSON.stringify(parsed.tasks));
      }
    } catch {
      /* line mode */
    }
    return trimmed
      .split(/\n+/)
      .map((line) => line.replace(/^[\s\-\*\d\.\)\:]+/, '').trim())
      .filter((line) => line.length > 2)
      .map((line) => {
        const upper = line.toUpperCase();
        let category = 'DESARROLLO';
        if (upper.includes('POSTUL') || upper.includes('BID')) category = 'POSTULACION';
        else if (upper.includes('ESTUD') || upper.includes('LEARN') || upper.includes('CURSO'))
          category = 'ESTUDIO';
        else if (upper.includes('DESCANS') || upper.includes('PAUSA') || upper.includes('SALUD') || upper.includes('WALK'))
          category = 'SALUD_MENTAL';
        let timeSpentMin: number | undefined;
        const m1 = line.match(/(\d+)\s*m(in)?/i);
        if (m1) timeSpentMin = Number(m1[1]);
        return { title: line, category, timeSpentMin };
      });
  }

  function tryParseDays(raw: string): Record<string, Array<{ title: string; category?: string; timeSpentMin?: number }>> | undefined {
    try {
      const parsed = JSON.parse(raw.trim());
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // { "2026-09-08": ["tarea", {title}], ... } o { days: { ... } }
        const src = parsed.days && typeof parsed.days === 'object' ? parsed.days : parsed;
        const out: Record<string, Array<{ title: string; category?: string; timeSpentMin?: number }>> = {};
        let hit = false;
        for (const [k, v] of Object.entries(src)) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
          hit = true;
          const list = Array.isArray(v) ? v : [];
          out[k] = list.map((item: any) =>
            typeof item === 'string'
              ? { title: item, category: 'DESARROLLO' }
              : {
                  title: item.title || item.name || String(item),
                  category: item.category || 'DESARROLLO',
                  timeSpentMin: item.timeSpentMin || item.minutes,
                },
          );
        }
        return hit ? out : undefined;
      }
    } catch {
      /* ignore */
    }
    return undefined;
  }

  async function handleImportRoutine() {
    const daysMap = tryParseDays(routineText);
    const parsed = parseRoutineText(routineText);
    if (!daysMap && !parsed.length) {
      alert(
        'No pude parsear. Usá JSON de un día [{title, category}] o de semana:\n' +
          '{ "2026-09-08": [{ "title": "Responder msgs", "category": "POSTULACION" }], "2026-09-09": [...] }',
      );
      return;
    }
    setImporting(true);
    try {
      let res: { imported: number };
      if (daysMap && (dailyTasksApi as any).importRoutineWeek) {
        res = await (dailyTasksApi as any).importRoutineWeek({
          userTag,
          days: daysMap,
          energyLevel: energy,
          replaceWeek: replaceToday,
        });
      } else if ((dailyTasksApi as any).importRoutineWeek && parsed.some((x: any) => x.date)) {
        res = await (dailyTasksApi as any).importRoutineWeek({
          userTag,
          tasks: parsed,
          energyLevel: energy,
          replaceWeek: replaceToday,
        });
      } else {
        res = await dailyTasksApi.importRoutine({
          userTag,
          tasks: parsed,
          energyLevel: energy,
          replaceToday,
          date: selectedDay,
        });
      }
      setRoutineText('');
      setShowImport(false);
      await load();
      alert(`Rutina cargada: ${res.imported} tareas`);
    } catch (e: any) {
      alert(e.message || 'Error al importar rutina');
    } finally {
      setImporting(false);
    }
  }

  const pending = tasks.filter((t) => !t.completed).length;
  const byCat = (c: string) => tasks.filter((t) => t.category === c);
  const todayISO = toISODate(new Date());

  // Heatmap del mes actual (calendario simple)
  const monthGrid = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startPad = (first.getDay() + 6) % 7;
    const cells: Array<{ date: string | null; day: number | null }> = [];
    for (let i = 0; i < startPad; i++) cells.push({ date: null, day: null });
    for (let d = 1; d <= last.getDate(); d++) {
      const iso = toISODate(new Date(year, month, d));
      cells.push({ date: iso, day: d });
    }
    return cells;
  }, []);

  function heatColor(date: string | null) {
    if (!date) return 'bg-transparent';
    const s = monthStats[date];
    if (!s || s.total === 0) return 'bg-surface-800/60';
    const ratio = s.done / Math.max(s.total, 1);
    if (ratio >= 0.8) return 'bg-emerald-500/80';
    if (ratio >= 0.5) return 'bg-emerald-600/50';
    if (ratio > 0) return 'bg-amber-600/40';
    return 'bg-surface-700';
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Home operativo</h1>
          <p className="text-sm text-surface-400 mt-1">
            Semana de trabajo · tareas por día · mapa mensual
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-surface-500">Operador</label>
          <select
            value={userTag}
            onChange={(e) => setUserTag(e.target.value as UserTag)}
            className="rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-100"
          >
            <option value="Dev1">Dev1</option>
            <option value="Dev2">Dev2</option>
          </select>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-surface-900 border border-surface-700 p-5">
          <div className="text-xs text-surface-400">Tareas del día</div>
          <div className="text-3xl font-semibold text-white mt-2">{pending}</div>
        </div>
        <div className="rounded-2xl bg-surface-900 border border-surface-700 p-5">
          <div className="text-xs text-surface-400">Postulaciones activas</div>
          <div className="text-3xl font-semibold text-white mt-2">{apps.length}</div>
        </div>
        <div className="rounded-2xl bg-surface-900 border border-surface-700 p-5">
          <div className="text-xs text-surface-400">Energía</div>
          <div className="text-3xl font-semibold text-gold-400 mt-2">{energy}/5</div>
        </div>
        <div className="rounded-2xl bg-surface-900 border border-surface-700 p-5 flex flex-col justify-between">
          <div className="text-xs text-surface-400">Prompt Hub</div>
          <button
            type="button"
            onClick={copyRoutinePrompt}
            className="mt-2 w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-3 py-2 transition"
          >
            Copiar prompt de rutina
          </button>
          <button
            type="button"
            onClick={() => setShowImport((v) => !v)}
            className="mt-2 w-full rounded-lg border border-surface-600 hover:border-gold-500/50 text-surface-200 text-sm font-medium px-3 py-2 transition"
          >
            Cargar rutina IA
          </button>
        </div>
      </div>

      {/* Semana de trabajo */}
      <section className="rounded-2xl bg-surface-900 border border-surface-700 p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold text-surface-100">Semana de trabajo</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setWeekAnchor((w) => addDays(w, -7))}
              className="rounded-lg border border-surface-700 px-3 py-1 text-xs text-surface-300 hover:border-surface-500"
            >
              ← Semana ant.
            </button>
            <button
              type="button"
              onClick={() => setWeekAnchor(startOfWeek(new Date()))}
              className="rounded-lg border border-surface-700 px-3 py-1 text-xs text-surface-300 hover:border-surface-500"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setWeekAnchor((w) => addDays(w, 7))}
              className="rounded-lg border border-surface-700 px-3 py-1 text-xs text-surface-300 hover:border-surface-500"
            >
              Semana sig. →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((d) => {
            const list = weekTasks[d.date] || [];
            const done = list.filter((t) => t.completed).length;
            const isSel = d.date === selectedDay;
            const isToday = d.date === todayISO;
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => setSelectedDay(d.date)}
                className={`rounded-xl border p-3 text-left transition min-h-[88px] ${
                  isSel
                    ? 'border-gold-500 bg-gold-500/10'
                    : 'border-surface-700 bg-surface-950/50 hover:border-surface-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-medium ${isToday ? 'text-gold-400' : 'text-surface-400'}`}>
                    {d.label}
                  </span>
                  <span className="text-sm font-semibold text-surface-100">{d.dayNum}</span>
                </div>
                <div className="mt-2 text-[11px] text-surface-500">
                  {list.length === 0 ? '—' : `${done}/${list.length}`}
                </div>
                {list.length > 0 && (
                  <div className="mt-1 h-1 rounded-full bg-surface-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${(done / list.length) * 100}%` }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {showImport && (
        <div className="rounded-2xl border border-indigo-500/30 bg-surface-900 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-surface-100">Cargar rutina generada por IA</h2>
            <label className="flex items-center gap-2 text-xs text-surface-400 cursor-pointer">
              <input
                type="checkbox"
                checked={replaceToday}
                onChange={(e) => setReplaceToday(e.target.checked)}
                className="rounded border-surface-600"
              />
              Reemplazar tareas del día
            </label>
          </div>
          <textarea
            value={routineText}
            onChange={(e) => setRoutineText(e.target.value)}
            rows={6}
            placeholder={`[{"title":"Responder 3 mensajes","category":"POSTULACION"}]\n\no lista con viñetas`}
            className="w-full rounded-lg border border-surface-700 bg-surface-950 px-3 py-2 text-sm text-surface-200 font-mono"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleImportRoutine}
              disabled={importing || !routineText.trim()}
              className="rounded-lg bg-gold-600 hover:bg-gold-500 disabled:opacity-40 text-surface-950 text-sm font-semibold px-4 py-2"
            >
              {importing ? 'Importando…' : `Importar a ${selectedDay}`}
            </button>
            <button
              type="button"
              onClick={() => setShowImport(false)}
              className="rounded-lg border border-surface-700 text-surface-400 text-sm px-4 py-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Energy */}
      <div className="rounded-2xl bg-surface-900 border border-surface-700 p-5">
        <div className="text-sm font-medium text-surface-200 mb-3">Nivel de energía (1–5) — {selectedDay}</div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => saveEnergy(n)}
              className={`w-12 h-12 rounded-full border text-sm font-semibold transition ${
                energy === n
                  ? 'bg-gold-500 border-gold-400 text-surface-950 scale-110'
                  : 'bg-surface-800 border-surface-600 text-surface-300 hover:border-gold-500/50'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Tasks del día seleccionado */}
        <section className="rounded-2xl bg-surface-900 border border-surface-700 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-surface-100">Tareas · {selectedDay}</h2>
            <span className="text-xs text-surface-500">{pending} pendientes</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTask()}
              placeholder="Nueva tarea…"
              className="flex-1 rounded-lg border border-surface-700 bg-surface-950 px-3 py-2 text-sm text-surface-100"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="rounded-lg border border-surface-700 bg-surface-950 px-2 py-2 text-sm text-surface-200"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={addTask}
              disabled={adding || !newTitle.trim()}
              className="rounded-lg bg-gold-600 hover:bg-gold-500 disabled:opacity-40 text-surface-950 text-sm font-medium px-4 py-2"
            >
              +
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-surface-500">Cargando…</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-surface-500 py-6 text-center">Sin tareas este día.</p>
          ) : (
            <div className="space-y-4">
              {CATEGORIES.map((cat) => {
                const list = byCat(cat);
                if (!list.length) return null;
                return (
                  <div key={cat}>
                    <div className="text-[10px] uppercase tracking-wider text-surface-500 mb-1.5">
                      {cat.replace('_', ' ')}
                    </div>
                    <div className="space-y-1.5">
                      {list.map((t) => (
                        <label
                          key={t.id}
                          className="flex items-center gap-3 rounded-lg border border-surface-800 bg-surface-950/50 px-3 py-2 hover:border-surface-600 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={t.completed}
                            onChange={() => toggleTask(t)}
                            className="rounded border-surface-600"
                          />
                          <span
                            className={`flex-1 text-sm ${
                              t.completed ? 'line-through text-surface-500' : 'text-surface-200'
                            }`}
                          >
                            {t.title}
                          </span>
                          {t.timeSpentMin > 0 && (
                            <span className="text-xs text-surface-500">{t.timeSpentMin}m</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Postulaciones + mapa mensual */}
        <div className="space-y-6">
          <section className="rounded-2xl bg-surface-900 border border-surface-700 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-surface-100">Postulaciones activas</h2>
              <Link href="/applications" className="text-xs text-gold-500 hover:text-gold-400">
                Ver todas →
              </Link>
            </div>
            {apps.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <p className="text-sm text-surface-500">Ninguna en curso</p>
                <Link href="/radar" className="inline-block text-sm text-gold-500 hover:text-gold-400">
                  Ir al Radar →
                </Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {apps.map((app) => (
                  <Link
                    key={app.id}
                    href={`/applications/${app.id}`}
                    className="block rounded-lg border border-surface-800 bg-surface-950/50 p-3 hover:border-gold-500/40 transition"
                  >
                    <div className="flex justify-between gap-2">
                      <span className="text-sm text-surface-100 line-clamp-2">{app.title}</span>
                      <span
                        className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${
                          STATUS_STYLE[app.status] || 'bg-surface-700 text-surface-400'
                        }`}
                      >
                        {app.status}
                      </span>
                    </div>
                    <div className="mt-1.5 flex justify-between text-xs text-surface-500">
                      <span>${app.submittedPrice}</span>
                      <span>{app._count?.messages ?? 0} msgs</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Mapa de rendimiento mensual */}
          <section className="rounded-2xl bg-surface-900 border border-surface-700 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-surface-100">Mapa de rendimiento</h2>
              <span className="text-[10px] text-surface-500">% tareas completadas</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {DAY_NAMES.map((n) => (
                <div key={n} className="text-[10px] text-surface-500">{n}</div>
              ))}
              {monthGrid.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={!c.date}
                  onClick={() => c.date && setSelectedDay(c.date)}
                  className={`aspect-square rounded-md text-[10px] font-medium transition ${heatColor(c.date)} ${
                    c.date === selectedDay ? 'ring-2 ring-gold-400' : ''
                  } ${c.date ? 'text-surface-100 hover:opacity-90' : ''}`}
                  title={c.date || undefined}
                >
                  {c.day ?? ''}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-surface-500 pt-1">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-surface-800/60 inline-block" /> vacío</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-600/40 inline-block" /> parcial</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/80 inline-block" /> alto</span>
            </div>
          </section>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Link href="/radar" className="rounded-2xl border border-surface-700 bg-surface-900 p-5 hover:border-gold-500 transition">
          <div className="text-xl mb-2">📡</div>
          <div className="font-medium text-surface-100">Radar</div>
          <p className="text-xs text-surface-500 mt-1">Escanear y postular (verde / dorado)</p>
        </Link>
        <Link href="/applications" className="rounded-2xl border border-surface-700 bg-surface-900 p-5 hover:border-gold-500 transition">
          <div className="text-xl mb-2">📨</div>
          <div className="font-medium text-surface-100">CRM postulaciones</div>
          <p className="text-xs text-surface-500 mt-1">Estados, chat y winners</p>
        </Link>
        <Link href="/crm" className="rounded-2xl border border-surface-700 bg-surface-900 p-5 hover:border-gold-500 transition">
          <div className="text-xl mb-2">👥</div>
          <div className="font-medium text-surface-100">CRM clientes</div>
          <p className="text-xs text-surface-500 mt-1">Clientes y proyectos internos</p>
        </Link>
      </div>
    </div>
  );
}
