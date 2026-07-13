'use client';
// apps/web/components/audit/audit-detail-client.tsx
// Owns the mutable audit state — score ring updates live as sections are saved.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SectionEditor } from './section-editor';
import { ScoreDisplay } from './score-display';
import { auditApi, type AuditDetail } from '../../lib/audit-api';

interface AuditDetailClientProps {
  audit: AuditDetail;
}

export function AuditDetailClient({ audit: initialAudit }: AuditDetailClientProps) {
  const [audit, setAudit] = useState<AuditDetail>(initialAudit);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const router = useRouter();

  const isDone = audit.status === 'DONE' || audit.status === 'ARCHIVED';

  async function handleSubmit() {
    if (!confirm('Mark this audit as complete? This cannot be undone.')) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await auditApi.submit(audit.id);
      router.refresh(); // re-fetch server component to show DONE status
    } catch (err: any) {
      setSubmitError(err.message ?? 'Failed to submit audit');
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full">

      {/* Left — sections */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl space-y-6">

          {/* General info (read-only for now) */}
          {audit.generalInfo && Object.keys(audit.generalInfo).length > 0 && (
            <div className="rounded-lg border border-surface-700 bg-surface-800/50 px-5 py-4">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-surface-400">
                General info
              </h2>
              <dl className="grid grid-cols-2 gap-3">
                {Object.entries(audit.generalInfo).map(([k, v]) => (
                  v ? (
                    <div key={k}>
                      <dt className="text-xs text-surface-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</dt>
                      <dd className="text-sm text-surface-200">{v as string}</dd>
                    </div>
                  ) : null
                ))}
              </dl>
            </div>
          )}

          {/* Section editor */}
          <SectionEditor
            audit={audit}
            onSave={(updated) => setAudit(updated)}
          />

          {/* Submit */}
          {!isDone && (
            <div className="border-t border-surface-700 pt-4">
              {submitError && (
                <p className="mb-3 rounded-md bg-red-950 px-3 py-2 text-sm text-red-400">
                  {submitError}
                </p>
              )}
              <button
                onClick={handleSubmit}
                disabled={submitting || audit.scoreResult.scoredSections === 0}
                className="rounded-md bg-gold-500 px-5 py-2 text-sm font-semibold text-surface-900 hover:bg-gold-400 disabled:opacity-50 transition"
              >
                {submitting ? 'Submitting…' : 'Submit audit'}
              </button>
              {audit.scoreResult.scoredSections === 0 && (
                <p className="mt-2 text-xs text-surface-500">
                  Score at least one section before submitting.
                </p>
              )}
              {audit.scoreResult.scoredSections > 0 && !audit.scoreResult.isComplete && (
                <p className="mt-2 text-xs text-surface-500">
                  {audit.scoreResult.totalSections - audit.scoreResult.scoredSections} section(s) not yet scored.
                  You can submit with partial scores.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar — live score */}
      <aside className="w-52 flex-shrink-0 border-l border-surface-700 bg-surface-950 p-5">
        <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-surface-500">
          Score
        </h2>
        <ScoreDisplay result={audit.scoreResult} size="lg" />

        {/* Section breakdown */}
        {audit.sections.length > 0 && (
          <div className="mt-6 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-surface-500">
              Breakdown
            </p>
            {audit.sections.map((s) => (
              <div key={s.key} className="flex items-center justify-between">
                <span className="text-xs text-surface-400 truncate max-w-[100px]" title={s.label}>
                  {s.label}
                </span>
                {s.score !== null ? (
                  <span className="text-xs font-mono font-bold tabular-nums text-surface-200">
                    {s.score}/10
                  </span>
                ) : (
                  <span className="text-xs text-surface-600">—</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Template info */}
        {audit.template && (
          <p className="mt-6 text-xs text-surface-600">
            Template: {audit.template.name}
          </p>
        )}
        <p className="mt-1 text-xs text-surface-600">
          v{audit.version}
        </p>
      </aside>
    </div>
  );
}
