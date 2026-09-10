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
  const toSave = (updatedSections ?? sections).map((section) => ({
    key: section.key,
    label: section.label,
    enabled: section.enabled !== false,
    score: section.score,
    observations: section.observations,
    evidenceUrls: section.evidenceUrls,
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

  const activeSections = sections.filter((s) => s.enabled !== false);
  const activeProgress = activeSections.filter((s) => s.score !== null).length;
  const progressPct = activeSections.length > 0 ? (activeProgress / activeSections.length) * 100 : 0;

  function addCustomSection() {
    const section: AuditSection = {
      key: `custom_${Date.now()}`,
      label: 'Otra sección',
      weight: 0,
      enabled: true,
      score: null,
      observations: '',
      evidenceUrls: [],
    };
    const next = [...sections, section];
    setSections(next);
    void save(next);
  }

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
          {activeProgress}/{activeSections.length} activas evaluadas
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

      <div className="border-b border-surface-700 pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-surface-300">Secciones del sitio</h2>
        <p className="mt-1 text-xs text-surface-500">Activá solo las áreas que existan en el sitio: desde Header &amp; Hero hasta Footer, más cualquier sección adicional.</p>
      </div>

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

      {!isDone && (
        <button
          type="button"
          onClick={addCustomSection}
          className="w-full rounded-md border border-dashed border-surface-600 px-4 py-3 text-sm text-surface-400 hover:border-gold-500 hover:text-gold-400 transition"
        >
          + Agregar otra sección
        </button>
      )}

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
  const enabled = section.enabled !== false;
  const scored = enabled && section.score !== null;
  const scoreColor =
    !scored ? undefined :
    section.score! >= 9 ? GRADE_COLORS['A'] :
    section.score! >= 7 ? GRADE_COLORS['B'] :
    section.score! >= 5 ? GRADE_COLORS['C'] :
    section.score! >= 3 ? GRADE_COLORS['D'] :
    GRADE_COLORS['F'];

  return (
    <div className={`rounded-lg border bg-surface-800 p-4 transition ${!enabled ? 'border-surface-800 opacity-60' : scored ? 'border-surface-600' : 'border-surface-700'}`}>

      {/* Section header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {section.key.startsWith('custom_') ? (
            <input
              value={section.label}
              disabled={disabled}
              onChange={(e) => onChange('label', e.target.value)}
              onBlur={onBlur}
              className="rounded border border-surface-700 bg-surface-900 px-2 py-1 text-sm font-semibold text-surface-100"
              placeholder="Nombre de la sección"
            />
          ) : (
            <h3 className="text-sm font-semibold text-surface-100">{section.label}</h3>
          )}
          {section.weight > 0 && (
            <span className="rounded bg-surface-700 px-1.5 py-0.5 text-xs text-surface-400">
              {section.weight}%
            </span>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs text-surface-400">
          <span>{enabled ? 'Tiene esta sección' : 'No tiene esta sección'}</span>
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            onChange={(e) => {
              onChange('enabled', e.target.checked);
              setTimeout(onBlur, 0);
            }}
            className="accent-gold-500"
          />
        </label>
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
            disabled={disabled || !enabled}
            onChange={(e) => onChange('score', Number(e.target.value))}
            onMouseUp={onBlur}
            onTouchEnd={onBlur}
            className="flex-1 accent-gold-500 disabled:opacity-40"
          />
          <span className="w-4 text-xs text-surface-500">10</span>
          <button
            type="button"
            disabled={disabled || !enabled}
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
        disabled={disabled || !enabled}
        onChange={(e) => onChange('observations', e.target.value)}
        onBlur={onBlur}
        className="w-full rounded-md border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-200 placeholder-surface-600 outline-none transition focus:border-gold-500 focus:ring-1 focus:ring-gold-500 disabled:opacity-50 resize-none"
      />

      {/* Evidence is stored as portable URLs so screenshots remain available after export. */}
      <textarea
        rows={2}
        placeholder="URLs de capturas, Lighthouse, WAVE o evidencia (una por línea)…"
        value={(section.evidenceUrls ?? []).join('\n')}
        disabled={disabled || !enabled}
        onChange={(e) =>
          onChange(
            'evidenceUrls',
            e.target.value
              .split('\n')
              .map((url) => url.trim())
              .filter(Boolean),
          )
        }
        onBlur={onBlur}
        className="mt-2 w-full rounded-md border border-surface-700 bg-surface-900 px-3 py-2 text-xs text-surface-300 placeholder-surface-600 outline-none transition focus:border-gold-500 disabled:opacity-50 resize-none"
      />
      <p className="mt-1 text-[11px] leading-relaxed text-surface-600">
        Captura el hallazgo, súbelo a la carpeta del cliente en Drive/Cloudinary, habilita acceso de lectura y pega aquí el enlace compartible. Una URL por línea.
      </p>
    </div>
  );
}
