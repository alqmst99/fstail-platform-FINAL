// apps/web/components/reports/block-renderer.tsx
'use client';

import { GRADE_COLORS, GRADE_LABELS, type Grade } from '../../lib/audit-api';
import type { ReportBlock } from '../../lib/reports-api';

interface BlockRendererProps {
  blocks: ReportBlock[];
  isPortal?: boolean;
}

export function BlockRenderer({ blocks, isPortal = false }: BlockRendererProps) {
  if (!blocks || blocks.length === 0) {
    return (
      <p className="text-sm text-surface-500 italic">
        This report has no content yet.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {blocks.map((block) => (
        <BlockItem key={block.id} block={block} isPortal={isPortal} />
      ))}
    </div>
  );
}

function BlockItem({ block, isPortal }: { block: ReportBlock; isPortal: boolean }) {
  switch (block.type) {
    case 'heading':
      return <HeadingBlock data={block.data} />;
    case 'text':
      return <TextBlock data={block.data} />;
    case 'audit_summary':
      return <AuditSummaryBlock data={block.data} isPortal={isPortal} />;
    case 'audit_comparison':
      return <AuditComparisonBlock data={block.data} />;
    case 'recommendations':
      return <RecommendationsBlock data={block.data} />;
    case 'divider':
      return <hr className="border-surface-700" />;
    default:
      return null;
  }
}

// ── Block components ──────────────────────────────────────────────────

function HeadingBlock({ data }: { data: Record<string, unknown> }) {
  const text = String(data['text'] ?? '');
  const level = Number(data['level'] ?? 2);
  const classes = [
    '',
    'text-2xl font-bold text-surface-50',
    'text-xl font-semibold text-surface-50',
    'text-lg font-semibold text-surface-100',
  ][Math.min(level, 3)] ?? 'text-base font-semibold text-surface-100';

  return <p className={classes}>{text}</p>;
}

function TextBlock({ data }: { data: Record<string, unknown> }) {
  return (
    <p className="text-sm leading-relaxed text-surface-300">
      {String(data['text'] ?? '')}
    </p>
  );
}

function AuditSummaryBlock({
  data,
  isPortal,
}: {
  data: Record<string, unknown>;
  isPortal: boolean;
}) {
  const grade = data['grade'] as Grade | null;
  const score = data['finalScore'] as number | null;
  const sections = (data['sections'] as any[]) ?? [];
  const color = grade ? GRADE_COLORS[grade] : '#64748b';

  return (
    <div className="rounded-lg border border-surface-700 bg-surface-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-700 px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-surface-50">
            {String(data['title'] ?? 'Audit')}
          </h3>
          {Boolean(data['clientName']) && (
  <p className="text-xs text-surface-400 mt-0.5">
    {String(data['clientName'])}
  </p>
)}
        </div>
        <div className="flex items-center gap-4">
          {score !== null && (
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums" style={{ color }}>
                {score}
                <span className="text-sm font-normal text-surface-500">/10</span>
              </p>
              {grade && (
                <p className="text-xs" style={{ color }}>
                  {grade} — {GRADE_LABELS[grade]}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Section scores */}
      {sections.length > 0 && (
        <div className="divide-y divide-surface-700/50">
          {sections.map((s: any) => {
            const sScore = s.score as number | null;
            const barPct = sScore !== null ? (sScore / 10) * 100 : 0;
            const barColor =
              sScore === null ? '#334155' :
              sScore >= 7 ? '#10b981' :
              sScore >= 5 ? '#f59e0b' : '#ef4444';

            return (
              <div key={s.key} className="px-5 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-surface-300">{s.label}</span>
                  <span className="text-sm font-mono font-bold tabular-nums text-surface-200">
                    {sScore !== null ? `${sScore}/10` : '—'}
                  </span>
                </div>
                {/* Score bar */}
                <div className="h-1.5 w-full rounded-full bg-surface-700">
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${barPct}%`, backgroundColor: barColor }}
                  />
                </div>
                {/* Observations — show in portal, hide in builder */}
                {isPortal && s.observations && (
                  <p className="mt-1.5 text-xs text-surface-500 leading-relaxed">
                    {s.observations}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AuditComparisonBlock({ data }: { data: Record<string, unknown> }) {
  const scores = (data['scores'] as any[]) ?? [];
  if (scores.length === 0) return null;

  const max = Math.max(...scores.map((s) => s.score ?? 0), 10);

  return (
    <div className="rounded-lg border border-surface-700 bg-surface-800 p-5">
      <h3 className="mb-4 text-sm font-semibold text-surface-300 uppercase tracking-wider">
        Comparison
      </h3>
      <div className="space-y-3">
        {scores.map((s: any) => {
          const pct = s.score !== null ? (s.score / max) * 100 : 0;
          return (
            <div key={s.id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-surface-300 truncate max-w-xs">{s.title}</span>
                <span className="text-sm font-bold font-mono text-gold-400 tabular-nums ml-3">
                  {s.score ?? '—'}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-700">
                <div
                  className="h-2 rounded-full bg-gold-500 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecommendationsBlock({ data }: { data: Record<string, unknown> }) {
  const items = (data['items'] as string[]) ?? [];

  return (
    <div className="rounded-lg border border-surface-700 bg-surface-800 p-5">
      <h3 className="mb-3 text-sm font-semibold text-surface-300 uppercase tracking-wider">
        Recommendations
      </h3>
      {items.length === 0 ? (
        <p className="text-sm italic text-surface-600">No recommendations added yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-surface-300">
              <span className="mt-0.5 text-gold-500 flex-shrink-0">→</span>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
