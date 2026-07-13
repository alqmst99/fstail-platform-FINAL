'use client';
// apps/web/app/(platform)/radar/page.tsx
// The main Radar UI — scan form + results + per-project proposal generation.

import { useState, FormEvent } from 'react';
import {
  radarApi,
  formatBudget,
  DIFFICULTY_COLORS,
  FRAMEWORK_DESCRIPTIONS,
  type FreelancerProject,
  type ScanResult,
  type Proposal,
  type Framework,
} from '../../../lib/radar-api';

type View = 'scan' | 'history';

export default function RadarPage() {
  const [view, setView] = useState<View>('scan');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');

  // Scan form state
  const [keyword, setKeyword] = useState('');
  const [escrowOnly, setEscrowOnly] = useState(false);
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');

  async function handleScan(e: FormEvent) {
    e.preventDefault();
    setScanError('');
    setScanning(true);
    setScanResult(null);
    try {
      const result = await radarApi.scan({
        keyword:   keyword || undefined,
        escrowOnly,
        minBudget: minBudget ? Number(minBudget) : undefined,
        maxBudget: maxBudget ? Number(maxBudget) : undefined,
        limit: 50,
      });
      setScanResult(result);
    } catch (err: any) {
      setScanError(err.message ?? 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="flex h-full flex-col">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-700 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-surface-50">Radar</h1>
          <p className="text-sm text-surface-400">Scan Freelancer.com and generate AI proposals</p>
        </div>
        <div className="flex rounded-md border border-surface-700 overflow-hidden">
          {(['scan', 'history'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 text-sm capitalize transition ${
                view === v
                  ? 'bg-surface-700 text-surface-50'
                  : 'text-surface-400 hover:bg-surface-800'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar — scan controls */}
        <aside className="w-64 flex-shrink-0 overflow-auto border-r border-surface-700 bg-surface-950 p-5">
          <form onSubmit={handleScan} className="space-y-4">
            <h2 className="text-xs font-medium uppercase tracking-wider text-surface-500">
              Scan settings
            </h2>

            <div>
              <label className="mb-1 block text-xs text-surface-400">Keyword</label>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="react typescript nextjs"
                className="w-full rounded border border-surface-600 bg-surface-900 px-2 py-1.5 text-sm text-surface-50 placeholder-surface-600 outline-none focus:border-gold-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-surface-400">Min $</label>
                <input
                  type="number"
                  value={minBudget}
                  onChange={(e) => setMinBudget(e.target.value)}
                  placeholder="0"
                  className="w-full rounded border border-surface-600 bg-surface-900 px-2 py-1.5 text-sm text-surface-50 outline-none focus:border-gold-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-surface-400">Max $</label>
                <input
                  type="number"
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(e.target.value)}
                  placeholder="∞"
                  className="w-full rounded border border-surface-600 bg-surface-900 px-2 py-1.5 text-sm text-surface-50 outline-none focus:border-gold-500"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={escrowOnly}
                onChange={(e) => setEscrowOnly(e.target.checked)}
                className="accent-gold-500"
              />
              <span className="text-xs text-surface-300">Escrow supported only</span>
            </label>

            {scanError && (
              <p className="rounded bg-red-950 px-2 py-1.5 text-xs text-red-400">{scanError}</p>
            )}

            <button
              type="submit"
              disabled={scanning}
              className="w-full rounded-md bg-gold-500 py-2 text-sm font-semibold text-surface-900 hover:bg-gold-400 disabled:opacity-60 transition"
            >
              {scanning ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-surface-900 border-t-transparent" />
                  Scanning…
                </span>
              ) : '⚡ Scan'}
            </button>
          </form>

          {scanResult && (
            <div className="mt-5 rounded-lg border border-surface-700 bg-surface-800 p-3 text-xs space-y-1">
              <p className="font-medium text-surface-200">Last scan</p>
              <p className="text-surface-400">{scanResult.validCount} / {scanResult.rawCount} passed filters</p>
              <p className="text-surface-600">{new Date(scanResult.scannedAt).toLocaleTimeString()}</p>
            </div>
          )}
        </aside>

        {/* Main area */}
        <main className="flex-1 overflow-auto">
          {view === 'scan' && (
            <ProjectGrid
              projects={scanResult?.projects ?? []}
              scanId={scanResult?.scanId}
              empty={!scanning && !scanResult}
            />
          )}
          {view === 'history' && <ScanHistory />}
        </main>
      </div>
    </div>
  );
}

// ── Project grid ──────────────────────────────────────────────────────

function ProjectGrid({
  projects,
  scanId,
  empty,
}: {
  projects: FreelancerProject[];
  scanId?: string;
  empty: boolean;
}) {
  if (empty) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-surface-500">
        <p className="text-4xl mb-3">📡</p>
        <p className="text-sm">Configure a scan and click ⚡ Scan to start</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-surface-500">
        No projects passed your filters. Try relaxing the budget or escrow setting.
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

// ── Project card ──────────────────────────────────────────────────────

function ProjectCard({
  project,
  scanId,
}: {
  project: FreelancerProject;
  scanId?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [framework, setFramework] = useState<Framework>('AIDA');
  const [generating, setGenerating] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [genError, setGenError] = useState('');

  async function handleGenerate() {
    setGenerating(true);
    setGenError('');
    try {
      const result = await radarApi.generateProposal({ project, framework, scanId });
      setProposal(result.proposal);
    } catch (err: any) {
      setGenError(err.message ?? 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="rounded-lg border border-surface-700 bg-surface-800 flex flex-col">

      {/* Card header */}
      <div
        className="flex items-start justify-between p-4 cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex-1 min-w-0 pr-3">
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
        </div>
        <div className="text-right flex-shrink-0 space-y-1">
          <p className="text-sm font-bold text-gold-400">{formatBudget(project)}</p>
          <p className="text-xs text-surface-500">{project.bidCount} bids</p>
          {project.owner.escrowComSupported && (
            <span className="inline-block rounded bg-emerald-950 px-1.5 py-0.5 text-xs text-emerald-400">
              Escrow ✓
            </span>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-surface-700 px-4 pb-4 space-y-3">

          {/* Description */}
          <p className="mt-3 text-xs text-surface-400 leading-relaxed line-clamp-4">
            {project.description || 'No description provided.'}
          </p>

          {/* Owner */}
          <p className="text-xs text-surface-500">
            Client: <span className="text-surface-300">@{project.owner.username}</span>
          </p>

          {/* Proposal generation */}
          {proposal ? (
            <ProposalDisplay proposal={proposal} />
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-surface-400">Framework</label>
                <select
                  value={framework}
                  onChange={(e) => setFramework(e.target.value as Framework)}
                  className="rounded border border-surface-600 bg-surface-900 px-2 py-1 text-xs text-surface-200 outline-none focus:border-gold-500"
                >
                  {(['AIDA', 'PAS', 'BAB'] as Framework[]).map((f) => (
                    <option key={f} value={f} title={FRAMEWORK_DESCRIPTIONS[f]}>
                      {f}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-surface-600">
                  {FRAMEWORK_DESCRIPTIONS[framework]}
                </span>
              </div>

              {genError && (
                <p className="rounded bg-red-950 px-2 py-1 text-xs text-red-400">{genError}</p>
              )}

              <button
                onClick={handleGenerate}
                disabled={generating}
                className="rounded-md bg-surface-700 px-3 py-1.5 text-xs font-medium text-surface-200 hover:bg-surface-600 disabled:opacity-60 transition"
              >
                {generating ? (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border border-surface-400 border-t-transparent" />
                    Generating…
                  </span>
                ) : '✨ Generate proposal'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Proposal display ──────────────────────────────────────────────────

function ProposalDisplay({ proposal }: { proposal: Proposal }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(proposal.proposalText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3 pt-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-surface-700 px-1.5 py-0.5 text-xs text-surface-400">
            {proposal.framework}
          </span>
          <span className={`text-xs font-medium ${DIFFICULTY_COLORS[proposal.difficulty]}`}>
            {proposal.difficulty}
          </span>
          {proposal.suggestedPrice && (
            <span className="text-xs text-gold-400">${proposal.suggestedPrice}</span>
          )}
          {proposal.deliveryDays && (
            <span className="text-xs text-surface-400">{proposal.deliveryDays}d</span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="rounded px-2 py-1 text-xs text-surface-400 hover:bg-surface-700 hover:text-surface-200 transition"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      {proposal.clientSummary && (
        <p className="rounded bg-surface-900 px-3 py-2 text-xs italic text-surface-400">
          {proposal.clientSummary}
        </p>
      )}

      <pre className="whitespace-pre-wrap rounded-md border border-surface-700 bg-surface-900 px-3 py-3 text-xs text-surface-200 font-sans leading-relaxed max-h-60 overflow-auto">
        {proposal.proposalText}
      </pre>

      {proposal.checklist.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-surface-400">Deliverables</p>
          <ul className="space-y-1">
            {proposal.checklist.map((item, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-surface-400">
                <span className="text-gold-500 mt-px">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-surface-600">Model: {proposal.modelUsed}</p>
    </div>
  );
}

// ── Scan history tab ──────────────────────────────────────────────────

function ScanHistory() {
  const [scans, setScans] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    radarApi.scans().then((r) => {
      setScans(r.data);
      setLoading(false);
    });
  });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-surface-500">
        Loading…
      </div>
    );
  }

  if (!scans || scans.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-surface-500">
        No scans yet. Run your first scan to see history here.
      </div>
    );
  }

  return (
    <div className="p-5 space-y-2">
      {scans.map((scan) => (
        <div
          key={scan.id}
          className="flex items-center justify-between rounded-lg border border-surface-700 bg-surface-800 px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium text-surface-100">
              {scan.keyword ?? scan.sourceUrl ?? 'Custom URL'}
            </p>
            <p className="text-xs text-surface-500">
              {scan.validCount}/{scan.rawCount} projects · {scan._count.proposals} proposals
            </p>
          </div>
          <p className="text-xs text-surface-600">
            {new Date(scan.createdAt).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
