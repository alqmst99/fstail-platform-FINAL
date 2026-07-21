// apps/web/lib/audit-api.ts
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type AuditStatus = 'DRAFT' | 'IN_PROGRESS' | 'DONE' | 'ARCHIVED';
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface AuditSection {
  key: string;
  label: string;
  weight: number;
  score: number | null;
  observations: string;
  evidenceUrls: string[];
}

export interface ScoreResult {
  finalScore: number | null;
  finalScoreInt: number | null;
  grade: Grade | null;
  scoredSections: number;
  totalSections: number;
  isComplete: boolean;
}

export type AuditSectionUpdate = {
  key: string;
  score: number | null;
  observations: string;
};

export interface AuditSummary {
  id: string;
  title: string;
  status: AuditStatus;
  finalScore: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string } | null;
  project: { id: string; title: string } | null;
  createdBy: { id: string; displayName: string };
}

export interface AuditDetail extends AuditSummary {
  generalInfo: Record<string, string>;
  sections: AuditSection[];
  scoreResult: ScoreResult;
  template: { id: string; name: string } | null;
}

export interface AuditTemplate {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  sections: { key: string; label: string; weight: number }[];
}

export interface AuditStats {
  total: number;
  draft: number;
  inProgress: number;
  done: number;
  archived: number;
  avgScore: number | null;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

function qs(params: Record<string, unknown>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const auditApi = {
  list: (params: { page?: number; pageSize?: number; search?: string; status?: AuditStatus; clientId?: string; projectId?: string } = {}) =>
    api<{ data: AuditSummary[]; total: number; totalPages: number }>(`/audits${qs(params)}`),

  stats: () => api<AuditStats>('/audits/stats'),

  templates: () => api<AuditTemplate[]>('/audits/templates'),

  get: (id: string) => api<AuditDetail>(`/audits/${id}`),

  create: (data: { title: string; clientId?: string; projectId?: string; templateId?: string; generalInfo?: Record<string, string> }) =>
    api<AuditSummary>('/audits', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<{ title: string; status: AuditStatus; clientId: string; projectId: string }>) =>
    api<AuditSummary>(`/audits/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  updateSections: (id: string, sections: Partial<AuditSection>[], version: number) =>
    api<AuditDetail & { isComplete: boolean }>(`/audits/${id}/sections`, {
      method: 'PATCH',
      body: JSON.stringify({ sections, version }),
    }),

  submit: (id: string) =>
    api<AuditSummary>(`/audits/${id}/submit`, { method: 'POST' }),

  delete: (id: string) => api<void>(`/audits/${id}`, { method: 'DELETE' }),
};

// ── Helpers ───────────────────────────────────────────────────────────

export const GRADE_COLORS: Record<Grade, string> = {
  A: '#10b981',
  B: '#3b82f6',
  C: '#f59e0b',
  D: '#f97316',
  F: '#ef4444',
};

export const GRADE_LABELS: Record<Grade, string> = {
  A: 'Excellent',
  B: 'Good',
  C: 'Needs improvement',
  D: 'Poor',
  F: 'Critical',
};
