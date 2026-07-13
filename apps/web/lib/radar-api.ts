// apps/web/lib/radar-api.ts
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type Framework = 'AIDA' | 'PAS' | 'BAB';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface FreelancerProject {
  id: number;
  title: string;
  seoUrl: string;
  description: string;
  budget: { minimum: number; maximum: number; currencyCode: string };
  currency: { sign: string; code: string };
  bidCount: number;
  skills: string[];
  owner: {
    id: number;
    username: string;
    escrowComSupported: boolean;
    hasLinkedEscrowAccount: boolean;
  };
  scannedAt: string;
}

export interface ScanResult {
  scanId: string;
  rawCount: number;
  validCount: number;
  projects: FreelancerProject[];
  scannedAt: string;
}

export interface Proposal {
  id: string;
  projectTitle: string;
  projectUrl: string | null;
  framework: Framework;
  proposalText: string;
  suggestedPrice: number | null;
  deliveryDays: number | null;
  difficulty: Difficulty;
  clientSummary: string;
  checklist: string[];
  modelUsed: string;
  createdAt: string;
}

export interface GenerateResult {
  proposal: Proposal;
  generated: Omit<Proposal, 'id' | 'projectTitle' | 'projectUrl' | 'createdAt'>;
}

export interface RadarStats {
  totalScans: number;
  totalProposals: number;
  byFramework: Record<string, number>;
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

export const radarApi = {
  stats: () => api<RadarStats>('/radar/stats'),

  scan: (params: {
    sourceUrl?: string;
    keyword?: string;
    limit?: number;
    escrowOnly?: boolean;
    minBudget?: number;
    maxBudget?: number;
    requiredSkills?: string[];
  }) =>
    api<ScanResult>('/radar/scan', { method: 'POST', body: JSON.stringify(params) }),

  scans: (page = 1) =>
    api<{ data: any[]; total: number; totalPages: number }>(
      `/radar/scans?page=${page}`,
    ),

  getScan: (id: string) => api<any>(`/radar/scans/${id}`),

  generateProposal: (params: {
    project: FreelancerProject;
    framework?: Framework;
    context?: string;
    scanId?: string;
  }) =>
    api<GenerateResult>('/radar/proposals/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  proposals: (params: { page?: number; framework?: Framework; scanId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.framework) qs.set('framework', params.framework);
    if (params.scanId) qs.set('scanId', params.scanId);
    return api<{ data: Proposal[]; total: number; totalPages: number }>(
      `/radar/proposals?${qs}`,
    );
  },

  getProposal: (id: string) => api<Proposal>(`/radar/proposals/${id}`),

  deleteProposal: (id: string) =>
    api<void>(`/radar/proposals/${id}`, { method: 'DELETE' }),
};

// ── Helpers ───────────────────────────────────────────────────────────

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  EASY:   'text-emerald-400',
  MEDIUM: 'text-gold-400',
  HARD:   'text-red-400',
};

export const FRAMEWORK_DESCRIPTIONS: Record<Framework, string> = {
  AIDA: 'Attention → Interest → Desire → Action',
  PAS:  'Problem → Agitate → Solution',
  BAB:  'Before → After → Bridge',
};

export function formatBudget(project: FreelancerProject): string {
  const { sign } = project.currency;
  const { minimum, maximum } = project.budget;
  if (minimum === maximum) return `${sign}${minimum}`;
  return `${sign}${minimum}–${sign}${maximum}`;
}
