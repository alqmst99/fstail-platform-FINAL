'use client';
// apps/web/components/audit/section-editor.tsx
// Interactive section scoring form with auto-save on blur.

import { useState, useCallback } from 'react';
import { auditApi, GRADE_COLORS, type AuditSection, type AuditDetail } from '../../lib/audit-api';

interface SectionEditorProps {
  audit: AuditDetail;
  onSave: (updated: AuditDetail) => void;
}

export function SectionEditor({ audit, onSave }: SectionEditorProps) {
  const [sections, setSections] = useState<AuditSection[]>(audit.sections);
  const [version, setVersion] = useState(audit.version);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const isDone = audit.status === 'DONE' || audit.status === 'ARCHIVED';

  const updateSection = useCallback((key: string, field: keyof AuditSection, value: unknown) => {
    setSections((prev) =>
      prev.map((s) => (s.key === key ? { ...s, [field]: value } : s)),
    );
  }, []);

  const save = useCallback(async (updatedSections?: AuditSection[]) => {
  // ←←← ESTO ES LO MÁS IMPORTANTE
  const toSave = (updatedSections ?? sections).map((section) => ({
    key: section.key,                    // identificador
    score: section.score,                // campo que se puede modificar
    observations: section.observations,  // campo que se puede modificar
    // NO enviar: label, weight, ni ningún otro campo
  }));

  setSaving(true);
  setError('');

  try {
    const result = await auditApi.updateSections(audit.id, toSave, version);
    
    setVersion(result.version);
    setLastSaved(new Date());
    onSave(result);
  } catch (err: any) {
    if (err.message?.includes('409') || err.message?.includes('conflict')) {
      setError('Otro usuario guardó este audit. Por favor recarga la página.');
    } else {
      setError(err.message ?? 'Error al guardar');
    }
  } finally {
    setSaving(false);
  }
}, [audit.id, sections, version, onSave]);

  const progress = sections.filter((s) => s.score !== null).length;
  const progressPct = sections.length > 0 ? (progress / sections.length) * 100 : 0;

  return (
    <div className="space-y-4">

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 rounded-full bg-surface-700">
          <div
            className="h-1.5 rounded-full bg-gold-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-xs text-surface-400 tabular-nums">
          {progress}/{sections.length} scored
        </span>
        {saving && <span className="text-xs text-surface-500">Saving…</span>}
        {lastSaved && !saving && (
          <span className="text-xs text-surface-600">
            Saved {lastSaved.toLocaleTimeString()}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-950 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Sections */}
      {sections.map((section) => (
        <SectionCard
          key={section.key}
          section={section}
          disabled={isDone}
          onChange={(field, value) => updateSection(section.key, field, value)}
          onBlur={() => save()}
        />
      ))}

      {/* Save button */}
      {!isDone && (
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => save()}
            disabled={saving}
            className="rounded-md bg-surface-700 px-4 py-2 text-sm font-medium text-surface-200 hover:bg-surface-600 disabled:opacity-60 transition"
          >
            {saving ? 'Saving…' : 'Save progress'}
          </button>
          <span className="text-xs text-surface-500">
            Sections also save automatically when you leave a field.
          </span>
        </div>
      )}
    </div>
  );
}

// ── Individual section card ────────────────────────────────────────────

interface SectionCardProps {
  section: AuditSection;
  disabled: boolean;
  onChange: (field: keyof AuditSection, value: unknown) => void;
  onBlur: () => void;
}

function SectionCard({ section, disabled, onChange, onBlur }: SectionCardProps) {
  const scored = section.score !== null;
  const scoreColor =
    !scored ? undefined :
    section.score! >= 9 ? GRADE_COLORS['A'] :
    section.score! >= 7 ? GRADE_COLORS['B'] :
    section.score! >= 5 ? GRADE_COLORS['C'] :
    section.score! >= 3 ? GRADE_COLORS['D'] :
    GRADE_COLORS['F'];

  return (
    <div className={`rounded-lg border bg-surface-800 p-4 transition ${scored ? 'border-surface-600' : 'border-surface-700'}`}>

      {/* Section header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-surface-100">{section.label}</h3>
          {section.weight > 0 && (
            <span className="rounded bg-surface-700 px-1.5 py-0.5 text-xs text-surface-400">
              {section.weight}%
            </span>
          )}
        </div>
        {scored && (
          <span className="text-lg font-bold tabular-nums" style={{ color: scoreColor }}>
            {section.score}/10
          </span>
        )}
      </div>

      {/* Score slider */}
      <div className="mb-3">
        <div className="flex items-center gap-3">
          <span className="w-4 text-xs text-surface-500 text-right">0</span>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={section.score ?? 5}
            disabled={disabled}
            onChange={(e) => onChange('score', Number(e.target.value))}
            onMouseUp={onBlur}
            onTouchEnd={onBlur}
            className="flex-1 accent-gold-500 disabled:opacity-40"
          />
          <span className="w-4 text-xs text-surface-500">10</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onChange('score', section.score === null ? 5 : null);
              setTimeout(onBlur, 0);
            }}
            className="ml-1 text-xs text-surface-500 hover:text-surface-300 disabled:opacity-40"
            title={scored ? 'Clear score' : 'Set score'}
          >
            {scored ? '✕' : 'Score'}
          </button>
        </div>
        {/* Tick marks */}
        <div className="mt-1 flex justify-between px-6">
          {[0,1,2,3,4,5,6,7,8,9,10].map((n) => (
            <span key={n} className="text-[9px] text-surface-600">{n}</span>
          ))}
        </div>
      </div>

      {/* Observations */}
      <textarea
        rows={3}
        placeholder="Observations, findings, recommendations…"
        value={section.observations}
        disabled={disabled}
        onChange={(e) => onChange('observations', e.target.value)}
        onBlur={onBlur}
        className="w-full rounded-md border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-200 placeholder-surface-600 outline-none transition focus:border-gold-500 focus:ring-1 focus:ring-gold-500 disabled:opacity-50 resize-none"
      />
    </div>
  );
}
