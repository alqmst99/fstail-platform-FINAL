// src/audit/__tests__/audit.scoring.spec.ts
import {
  calculateScore,
  mergeSections,
  scoreToGrade,
  gradeLabel,
} from '../audit.scoring';

describe('calculateScore', () => {
  const baseSection = { key: 'test', score: null as number | null };

  it('returns null finalScore when no sections scored', () => {
    const result = calculateScore([
      { ...baseSection, key: 'a' },
      { ...baseSection, key: 'b' },
    ]);
    expect(result.finalScore).toBeNull();
    expect(result.grade).toBeNull();
    expect(result.scoredSections).toBe(0);
    expect(result.isComplete).toBe(false);
  });

  it('calculates simple average when no weights defined', () => {
    const result = calculateScore([
      { key: 'a', score: 8 },
      { key: 'b', score: 6 },
      { key: 'c', score: 7 },
    ]);
    expect(result.finalScore).toBe(7);
    expect(result.grade).toBe('B');
    expect(result.isComplete).toBe(true);
  });

  it('calculates weighted average when weights defined', () => {
    const result = calculateScore([
      { key: 'performance', score: 8, weight: 20 },
      { key: 'seo',         score: 6, weight: 20 },
      { key: 'ux',          score: 9, weight: 20 },
      { key: 'security',    score: 7, weight: 20 },
      { key: 'a11y',        score: 5, weight: 10 },
      { key: 'content',     score: 4, weight: 10 },
    ]);
    // (8*20 + 6*20 + 9*20 + 7*20 + 5*10 + 4*10) / 100
    // = (160+120+180+140+50+40) / 100 = 690/100 = 6.9
    expect(result.finalScore).toBe(6.9);
    expect(result.grade).toBe('B');
  });

  it('excludes null-scored sections from average', () => {
    const result = calculateScore([
      { key: 'a', score: 10 },
      { key: 'b', score: null },
      { key: 'c', score: 8  },
    ]);
    expect(result.finalScore).toBe(9);
    expect(result.scoredSections).toBe(2);
    expect(result.totalSections).toBe(3);
    expect(result.isComplete).toBe(false);
  });

  it('rounds to 1 decimal place', () => {
    const result = calculateScore([
      { key: 'a', score: 7 },
      { key: 'b', score: 8 },
      { key: 'c', score: 9 },
    ]);
    // 24/3 = 8.0
    expect(result.finalScore).toBe(8);
  });

  it('handles single scored section', () => {
    const result = calculateScore([{ key: 'a', score: 5 }]);
    expect(result.finalScore).toBe(5);
    expect(result.grade).toBe('C');
    expect(result.isComplete).toBe(true);
  });

  it('returns finalScoreInt as rounded integer', () => {
    const result = calculateScore([
      { key: 'a', score: 7 },
      { key: 'b', score: 8 },
    ]);
    expect(result.finalScoreInt).toBe(8); // 7.5 rounds to 8
  });
});

describe('scoreToGrade', () => {
  it.each([
    [9,   'A'],
    [9.5, 'A'],
    [10,  'A'],
    [7,   'B'],
    [8.9, 'B'],
    [5,   'C'],
    [6.9, 'C'],
    [3,   'D'],
    [4.9, 'D'],
    [0,   'F'],
    [2.9, 'F'],
  ] as [number, string][])(
    'score %d → grade %s',
    (score, expected) => {
      expect(scoreToGrade(score)).toBe(expected);
    },
  );
});

describe('gradeLabel', () => {
  it('returns a label for each grade', () => {
    expect(gradeLabel('A')).toBe('Excellent');
    expect(gradeLabel('F')).toBe('Critical');
  });
});

describe('mergeSections', () => {
  const existing = [
    { key: 'performance', score: null, observations: '', evidenceUrls: [] },
    { key: 'seo',         score: 7,    observations: 'Good meta tags', evidenceUrls: [] },
    { key: 'ux',          score: null, observations: '', evidenceUrls: [] },
  ];

  it('updates only sections present in updates array', () => {
    const result = mergeSections(existing, [
      { key: 'performance', score: 8, observations: 'Fast LCP' },
    ]);
    expect(result[0]!.score).toBe(8);
    expect(result[0]!.observations).toBe('Fast LCP');
    expect(result[1]!.score).toBe(7); // unchanged
    expect(result[2]!.score).toBeNull(); // unchanged
  });

  it('preserves all sections even if none are updated', () => {
    const result = mergeSections(existing, []);
    expect(result).toHaveLength(3);
    expect(result).toEqual(existing);
  });

  it('merges partial fields — does not wipe unspecified fields', () => {
    const result = mergeSections(existing, [
      { key: 'seo', score: 9 }, // only updating score, not observations
    ]);
    expect(result[1]!.score).toBe(9);
    expect(result[1]!.observations).toBe('Good meta tags'); // preserved
  });

  it('ignores updates for keys not in existing sections', () => {
    const result = mergeSections(existing, [
      { key: 'nonexistent', score: 5 },
    ]);
    expect(result).toHaveLength(3);
  });
});
