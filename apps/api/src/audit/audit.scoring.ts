// src/audit/audit.scoring.ts
// Pure scoring logic — no DB access, fully testable.
//
// Scoring model:
//   Each section has a weight (default equal weight if template omits it).
//   Final score = weighted average of all scored sections, rounded to 1 decimal.
//   Sections with null score are excluded from the average (not penalised).

export interface ScoredSection {
  key: string;
  label?: string;
  score: number | null;
  weight?: number; // percentage 0-100; if omitted, equal weight assumed
  observations?: string;
  evidenceUrls?: string[];
}

export interface ScoreResult {
  finalScore: number | null; // null if no sections have been scored yet
  finalScoreInt: number | null; // rounded to nearest integer (stored in DB)
  grade: Grade | null;
  scoredSections: number;
  totalSections: number;
  isComplete: boolean; // all sections scored
}

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export function calculateScore(sections: ScoredSection[]): ScoreResult {
  const scored = sections.filter((s) => s.score !== null && s.score !== undefined);
  const totalSections = sections.length;
  const scoredSections = scored.length;

  if (scoredSections === 0) {
    return {
      finalScore: null,
      finalScoreInt: null,
      grade: null,
      scoredSections: 0,
      totalSections,
      isComplete: false,
    };
  }

  const hasWeights = scored.some((s) => s.weight !== undefined && s.weight !== null);

  let finalScore: number;

  if (hasWeights) {
    // Weighted average — only over scored sections
    const totalWeight = scored.reduce((sum, s) => sum + (s.weight ?? 0), 0);
    if (totalWeight === 0) {
      // Fallback to simple average if all weights are 0
      finalScore = scored.reduce((sum, s) => sum + s.score!, 0) / scoredSections;
    } else {
      finalScore =
        scored.reduce((sum, s) => sum + s.score! * (s.weight ?? 0), 0) / totalWeight;
    }
  } else {
    // Simple average
    finalScore = scored.reduce((sum, s) => sum + s.score!, 0) / scoredSections;
  }

  const rounded = Math.round(finalScore * 10) / 10;

  return {
    finalScore: rounded,
    finalScoreInt: Math.round(rounded),
    grade: scoreToGrade(rounded),
    scoredSections,
    totalSections,
    isComplete: scoredSections === totalSections,
  };
}

export function scoreToGrade(score: number): Grade {
  if (score >= 9) return 'A';
  if (score >= 7) return 'B';
  if (score >= 5) return 'C';
  if (score >= 3) return 'D';
  return 'F';
}

export function gradeLabel(grade: Grade): string {
  const labels: Record<Grade, string> = {
    A: 'Excellent',
    B: 'Good',
    C: 'Needs improvement',
    D: 'Poor',
    F: 'Critical',
  };
  return labels[grade];
}

export function gradeColor(grade: Grade): string {
  const colors: Record<Grade, string> = {
    A: '#10b981', // emerald
    B: '#3b82f6', // blue
    C: '#f59e0b', // gold
    D: '#f97316', // orange
    F: '#ef4444', // red
  };
  return colors[grade];
}

/**
 * Merges incoming section updates with the existing stored sections.
 * Incoming sections are identified by key — only updated fields change.
 * Sections in the template not yet touched are preserved as-is.
 */
export function mergeSections(
  existing: ScoredSection[],
  updates: Partial<ScoredSection>[],
): ScoredSection[] {
  const updateMap = new Map(updates.map((u) => [u.key, u]));

  return existing.map((section) => {
    const update = updateMap.get(section.key);
    if (!update) return section;
    return { ...section, ...update };
  });
}
