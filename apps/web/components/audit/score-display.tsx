'use client';
// apps/web/components/audit/score-display.tsx
import { GRADE_COLORS, GRADE_LABELS, type ScoreResult } from '../../lib/audit-api';

interface ScoreDisplayProps {
  result: ScoreResult;
  size?: 'sm' | 'lg';
}

export function ScoreDisplay({ result, size = 'lg' }: ScoreDisplayProps) {
  const { finalScore, grade, scoredSections, totalSections, isComplete } = result;

  const dim = size === 'lg' ? 120 : 72;
  const stroke = size === 'lg' ? 8 : 5;
  const r = (dim - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = finalScore !== null ? finalScore / 10 : 0;
  const offset = circumference * (1 - pct);
  const color = grade ? GRADE_COLORS[grade] : '#334155';

  return (
    <div className="flex flex-col items-center gap-2">

      {/* Ring */}
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle
            cx={dim / 2} cy={dim / 2} r={r}
            fill="none"
            stroke="#1e293b"
            strokeWidth={stroke}
          />
          {/* Progress */}
          <circle
            cx={dim / 2} cy={dim / 2} r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {finalScore !== null ? (
            <>
              <span
                className={`font-bold tabular-nums leading-none ${size === 'lg' ? 'text-2xl' : 'text-lg'}`}
                style={{ color }}
              >
                {finalScore}
              </span>
              {size === 'lg' && (
                <span className="text-xs text-surface-500">/ 10</span>
              )}
            </>
          ) : (
            <span className="text-xs text-surface-600">N/A</span>
          )}
        </div>
      </div>

      {/* Grade badge */}
      {grade && (
        <div className="flex flex-col items-center">
          <span
            className={`font-bold ${size === 'lg' ? 'text-2xl' : 'text-lg'}`}
            style={{ color }}
          >
            {grade}
          </span>
          {size === 'lg' && (
            <span className="text-xs text-surface-400">{GRADE_LABELS[grade]}</span>
          )}
        </div>
      )}

      {/* Progress text */}
      <span className="text-xs text-surface-500">
        {scoredSections}/{totalSections} sections
        {isComplete && ' ✓'}
      </span>
    </div>
  );
}
