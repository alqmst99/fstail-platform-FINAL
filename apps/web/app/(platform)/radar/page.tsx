'use client';

import { useMemo, useState, FormEvent } from 'react';
import {
  radarApi,
  formatBudget,
  FRAMEWORK_DESCRIPTIONS,
  type FreelancerProject,
  type ScanResult,
  type Proposal,
  type Framework,
} from '../../../lib/radar-api';
import { applicationsApi } from '../../../lib/applications-api';

type View = 'scan' | 'history';
type ProjectTier = 'premium' | 'good' | 'normal' | 'old';

const NEW_HOURS = 6; // < 6h = "nuevo"
const OLD_HOURS = 48; // > 48h = "viejo"

function hoursSince(iso?: string | null): number {
  if (!iso) return 999;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 999;
  return (Date.now() - t) / 3_600_000;
}

/** Clasificación de radar */
function classifyTier(p: FreelancerProject & Record<string, any>): ProjectTier {
  const ageH = hoursSince(p.timeSubmitted || p.scannedAt || p.postedAt);
  const bids = Number(p.bidCount ?? 0);
  const budgetMax = Number(p.budget?.maximum ?? p.budget?.minimum ?? 0);
  const paymentOk = p.paymentVerified !== false && (p.owner as any)?.paymentVerified !== false;
  const hire = Number((p as any).hireRate ?? 0);
  const reviews = Number((p as any).reviewsCount ?? 0);

  const isPremium =
    paymentOk &&
    budgetMax >= 200 &&
    bids <= 8 &&
    (reviews === 0 || hire >= 0.6) &&
    ageH <= NEW_HOURS;

  const isGood =
    paymentOk &&
    bids <= 12 &&
    ageH <= NEW_HOURS &&
    budgetMax >= 50;

  if (ageH > OLD_HOURS) return 'old';
  if (isPremium) return 'premium';
  if (isGood) return 'good';
  if (ageH <= NEW_HOURS) return 'normal';
  return 'old';
}

const TIER_STYLE: Record<ProjectTier, { border: string; badge: string; label: string; order: number }> = {
  premium: {
    border: 'border-amber-400/70 ring-1 ring-amber-400/30',
    badge: 'bg-amber-400 text-surface-950',
    label: 'Nuevo premium',
    order: 0,
  },
  good: {
    border: 'border-emerald-500/60 ring-1 ring-emerald-500/20',
    badge: 'bg-emerald-500 text-white',
    label: 'Nuevo bueno',
    order: 1,
  },
  normal: {
    border: 'border-surface-600',
    badge: 'bg-sky-600/80 text-white',
    label: 'Nuevo normal',
    order: 2,
  },
  old: {
    border: 'border-surface-800 opacity-75',
    badge: 'bg-surface-700 text-surface-300',
    label: 'Viejo',
    order: 3,
  },
};

function sortProjects(list: FreelancerProject[]): FreelancerProject[] {
  return [...list].sort((a, b) => {
    const ta = classifyTier(a as any);
    const tb = classifyTier(b as any);
    const oa = TIER_STYLE[ta].order;
    const ob = TIER_STYLE[tb].order;
    if (oa !== ob) return oa - ob;
    // dentro del mismo tier: menos bids primero, luego más reciente
    const bidsA = Number(a.bidCount ?? 99);
    const bidsB = Number(b.bidCount ?? 99);
    if (bidsA !== bidsB) return bidsA - bidsB;
    const ha = hoursSince((a as any).timeSubmitted || a.scannedAt);
    const hb = hoursSince((b as any).timeSubmitted || b.scannedAt);
    return ha - hb;
  });
}

export default function RadarPage() {
  const [view, setView] = useState<View>('scan');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');

  const [keyword, setKeyword] = useState('');
  const [escrowOnly, setEscrowOnly] = useState(false);
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');

  const [requirePaymentVerified, setRequirePaymentVerified] = useState(false);
  const [requireHireRate60, setRequireHireRate60] = useState(false);
  const [requireMinDescription, setRequireMinDescription] = useState(false);
  const [requireMaxBids, setRequireMaxBids] = useState(false);
  const [minDescriptionLength, setMinDescriptionLength] = useState(120);
  const [maxBidCount, setMaxBidCount] = useState(15);

  const sortedProjects = useMemo(
    () => sortProjects(scanResult?.projects ?? []),
    [scanResult],
  );

  const tierCounts = useMemo(() => {
    const c = { premium: 0, good: 0, normal: 0, old: 0 };
    for (const p of sortedProjects) c[classifyTier(p as any)]++;
    return c;
  }, [sortedProjects]);

  async function handleScan(e: FormEvent) {
    e.preventDefault();
    setScanError('');
    setScanning(true);
    setScanResult(null);
    try {
      const params: Record<string, unknown> = {
        escrowOnly,
        limit: 80,
        requirePaymentVerified,
        requireHireRate60,
        requireMinDescription,
        requireMaxBids,
        minDescriptionLength,
        maxBidCount,
      };
      if (keyword.trim()) params.keyword = keyword;
      if (minBudget) params.minBudget = Number(minBudget);
      if (maxBudget) params.maxBudget = Number(maxBudget);

      const result = await radarApi.scan(params as any);
      setScanResult(result);
    } catch (err: any) {
      setScanError(err.message ?? 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-surface-700 px-5 py-3">
        <div>
          <h1 className="text-lg font-semibold text-surface-50">Radar</h1>
          <p className="text-xs text-surface-500">
            Ordenado por calidad · tiempo · bids · colores por tier
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-surface-900 p-0.5 border border-surface-700">
          {(['scan', 'history'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                view === v ? 'bg-surface-700 text-surface-50' : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              {v === 'scan' ? 'Scan' : 'Historial'}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 shrink-0 border-r border-surface-700 bg-surface-950 overflow-y-auto p-4 space-y-5">
          <form onSubmit={handleScan} className="space-y-4">
            <div>
              <label className="text-xs text-surface-500">Keyword</label>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="react, nextjs…"
                className="mt-1 w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-surface-500">Min $</label>
                <input
                  type="number"
                  value={minBudget}
                  onChange={(e) => setMinBudget(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-surface-700 bg-surface-900 px-2 py-2 text-sm text-surface-100"
                />
              </div>
              <div>
                <label className="text-xs text-surface-500">Max $</label>
                <input
                  type="number"
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-surface-700 bg-surface-900 px-2 py-2 text-sm text-surface-100"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer">
              <input
                type="checkbox"
                checked={escrowOnly}
                onChange={(e) => setEscrowOnly(e.target.checked)}
                className="rounded border-surface-600"
              />
              Solo escrow
            </label>

            <div className="rounded-xl border border-surface-700 bg-surface-900/60 p-3 space-y-2.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-gold-500/90">
                Filtros de calidad
              </div>
              <p className="text-[11px] text-surface-500 leading-snug">
                Activá solo los que quieras. Por defecto ninguno (más resultados).
              </p>

              <label className="flex items-start gap-2 text-sm text-surface-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requirePaymentVerified}
                  onChange={(e) => setRequirePaymentVerified(e.target.checked)}
                  className="mt-0.5 rounded border-surface-600"
                />
                <span>
                  Payment verified
                  <span className="block text-[11px] text-surface-500">Cliente con pago verificado</span>
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm text-surface-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireHireRate60}
                  onChange={(e) => setRequireHireRate60(e.target.checked)}
                  className="mt-0.5 rounded border-surface-600"
                />
                <span>
                  Hire rate ≥ 60%
                  <span className="block text-[11px] text-surface-500">Si tiene reviews</span>
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm text-surface-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireMinDescription}
                  onChange={(e) => setRequireMinDescription(e.target.checked)}
                  className="mt-0.5 rounded border-surface-600"
                />
                <span className="flex-1">
                  Descripción mínima
                  <span className="block text-[11px] text-surface-500 mb-1">chars</span>
                  <input
                    type="number"
                    value={minDescriptionLength}
                    onChange={(e) => setMinDescriptionLength(Number(e.target.value) || 120)}
                    disabled={!requireMinDescription}
                    className="w-20 rounded border border-surface-700 bg-surface-950 px-2 py-1 text-xs disabled:opacity-40"
                  />
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm text-surface-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireMaxBids}
                  onChange={(e) => setRequireMaxBids(e.target.checked)}
                  className="mt-0.5 rounded border-surface-600"
                />
                <span className="flex-1">
                  Máx. bids (anti-saturación)
                  <span className="block text-[11px] text-surface-500 mb-1">tope</span>
                  <input
                    type="number"
                    value={maxBidCount}
                    onChange={(e) => setMaxBidCount(Number(e.target.value) || 15)}
                    disabled={!requireMaxBids}
                    className="w-20 rounded border border-surface-700 bg-surface-950 px-2 py-1 text-xs disabled:opacity-40"
                  />
                </span>
              </label>
            </div>

            {scanError && <p className="text-xs text-red-400">{scanError}</p>}

            <button
              type="submit"
              disabled={scanning}
              className="w-full rounded-lg bg-gold-600 hover:bg-gold-500 disabled:opacity-50 text-surface-950 font-semibold text-sm py-2.5 transition"
            >
              {scanning ? 'Escaneando…' : '⚡ Scan'}
            </button>
          </form>

          {scanResult && (
            <div className="text-xs text-surface-400 space-y-2 border-t border-surface-800 pt-3">
              <p>
                <span className="text-surface-200 font-medium">{scanResult.validCount}</span> /{' '}
                {scanResult.rawCount} pasaron filtros
              </p>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded px-1.5 py-0.5 bg-amber-400/20 text-amber-300">★ {tierCounts.premium}</span>
                <span className="rounded px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300">● {tierCounts.good}</span>
                <span className="rounded px-1.5 py-0.5 bg-sky-600/20 text-sky-300">○ {tierCounts.normal}</span>
                <span className="rounded px-1.5 py-0.5 bg-surface-700 text-surface-400">· {tierCounts.old}</span>
              </div>
              <p className="text-surface-600">{new Date(scanResult.scannedAt).toLocaleTimeString()}</p>
            </div>
          )}
        </aside>

        <main className="flex-1 overflow-auto">
          {view === 'scan' && (
            <ProjectGrid
              projects={sortedProjects}
              scanId={scanResult?.scanId}
              empty={!scanning && !scanResult}
              scanning={scanning}
            />
          )}
          {view === 'history' && (
            <div className="p-8 text-sm text-surface-500 text-center">
              Historial de scans — usá la API de scans existente.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ProjectGrid({
  projects,
  scanId,
  empty,
  scanning,
}: {
  projects: FreelancerProject[];
  scanId?: string;
  empty: boolean;
  scanning: boolean;
}) {
  if (scanning) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-surface-400">
        Escaneando Freelancer…
      </div>
    );
  }
  if (empty) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-surface-500">
        <p className="text-4xl mb-3">📡</p>
        <p className="text-sm">Elegí filtros (opcionales) y dale a Scan</p>
      </div>
    );
  }
  if (projects.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-surface-500 px-6 text-center">
        Ningún proyecto pasó los filtros. Desactivá alguno de calidad o ampliá budget.
      </div>
    );
  }
  return (
    <div className="grid gap-3 p-5 grid-cols-1 xl:grid-cols-2">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} scanId={scanId} />
      ))}
    </div>
  );
}

function ProjectCard({ project, scanId }: { project: FreelancerProject; scanId?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [framework, setFramework] = useState<Framework>('AIDA');
  const [generating, setGenerating] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [genError, setGenError] = useState('');

  const [price, setPrice] = useState<number>(project.budget?.minimum || 50);
  const [days, setDays] = useState(7);
  const [bidText, setBidText] = useState('');
  const [bidding, setBidding] = useState(false);
  const [bidMsg, setBidMsg] = useState('');

  const tier = classifyTier(project as any);
  const style = TIER_STYLE[tier];
  const ageH = hoursSince((project as any).timeSubmitted || project.scannedAt);

  async function handleGenerate() {
    setGenerating(true);
    setGenError('');
    try {
      const result = await radarApi.generateProposal({ project, framework, scanId });
      setProposal(result.proposal);
      if (result.proposal?.proposalText) setBidText(result.proposal.proposalText);
      if (result.proposal?.suggestedPrice) setPrice(result.proposal.suggestedPrice);
      if (result.proposal?.deliveryDays) setDays(result.proposal.deliveryDays);
    } catch (err: any) {
      setGenError(err.message ?? 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleBid() {
    if (!bidText.trim()) {
      setBidMsg('Escribí o generá una propuesta primero');
      return;
    }
    setBidding(true);
    setBidMsg('');
    try {
      const app = await applicationsApi.create({
        freelancerProjId: String(project.id),
        title: project.title,
        rawDescription: project.description || '',
        avgBidPrice: 0,
        recommendedPrice: price,
        submittedPrice: price,
        submittedDays: days,
        proposalText: bidText,
        assignedToUserTag: localStorage.getItem('userTag') || 'Dev1',
      });
      setBidMsg(`Postulado ✓ (id ${app.id?.slice?.(0, 8) || 'ok'})`);
      if (typeof window !== 'undefined' && (window as any).electronAPI?.notify) {
        (window as any).electronAPI.notify({
          title: 'Postulación enviada',
          body: project.title,
          applicationId: app.id,
        });
      }
    } catch (err: any) {
      setBidMsg(err.message || 'Error al postular');
    } finally {
      setBidding(false);
    }
  }

  return (
    <div className={`rounded-lg border bg-surface-800 flex flex-col ${style.border}`}>
      <div
        className="flex items-start justify-between p-4 cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex-1 min-w-0 pr-3">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${style.badge}`}>
              {style.label}
            </span>
            <span className="text-[10px] text-surface-500">
              {ageH < 1 ? `${Math.round(ageH * 60)}m` : `${Math.round(ageH)}h`} · {project.bidCount} bids
            </span>
          </div>
          <a
            href={`https://www.freelancer.com/projects/${project.seoUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-semibold text-surface-50 hover:text-gold-400 line-clamp-2"
          >
            {project.title}
          </a>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {project.skills.slice(0, 5).map((s) => (
              <span key={s} className="rounded bg-surface-700 px-1.5 py-0.5 text-xs text-surface-400">
                {s}
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-3 text-xs text-surface-400">
            <span>{formatBudget(project)}</span>
            <span>@{project.owner?.username}</span>
          </div>
        </div>
        <span className="text-surface-500 text-xs">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="border-t border-surface-700 p-4 space-y-4">
          <p className="text-xs text-surface-400 whitespace-pre-wrap max-h-32 overflow-y-auto">
            {project.description}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={framework}
              onChange={(e) => setFramework(e.target.value as Framework)}
              className="rounded border border-surface-600 bg-surface-900 px-2 py-1.5 text-xs text-surface-200"
            >
              {Object.keys(FRAMEWORK_DESCRIPTIONS).map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-lg bg-surface-700 hover:bg-surface-600 text-xs px-3 py-1.5 text-surface-100 disabled:opacity-50"
            >
              {generating ? 'Generando…' : 'Generar propuesta IA'}
            </button>
            {genError && <span className="text-xs text-red-400">{genError}</span>}
          </div>

          <div className="rounded-xl border border-gold-500/30 bg-surface-900/80 p-3 space-y-2">
            <div className="text-xs font-semibold text-gold-500">Postular y mandar</div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-surface-500">Precio USD</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full rounded border border-surface-700 bg-surface-950 px-2 py-1.5 text-sm text-surface-100"
                />
              </div>
              <div className="w-20">
                <label className="text-[10px] text-surface-500">Días</label>
                <input
                  type="number"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="w-full rounded border border-surface-700 bg-surface-950 px-2 py-1.5 text-sm text-surface-100"
                />
              </div>
            </div>
            <textarea
              value={bidText}
              onChange={(e) => setBidText(e.target.value)}
              rows={4}
              placeholder="Texto de la propuesta…"
              className="w-full rounded border border-surface-700 bg-surface-950 px-2 py-1.5 text-xs text-surface-200"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBid}
                disabled={bidding}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2"
              >
                {bidding ? 'Enviando…' : 'Postular y Mandar'}
              </button>
              {bidMsg && <span className="text-xs text-surface-400">{bidMsg}</span>}
            </div>
          </div>

          {proposal && (
            <div className="text-[11px] text-surface-500">
              IA: {proposal.framework} · sugerido ${proposal.suggestedPrice} · {proposal.deliveryDays}d
            </div>
          )}
        </div>
      )}
    </div>
  );
}
