// apps/web/lib/reports-api.ts
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface ReportBlock {
  type: string;
  id: string;
  data: Record<string, unknown>;
}

export interface ReportSummary {
  id: string;
  title: string;
  portalToken: string | null;
  portalTokenExpiresAt: string | null;
  portalActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; displayName: string };
}

export interface ReportDetail extends ReportSummary {
  content: { blocks: ReportBlock[]; version: number };
  workspace: { name: string };
}

export interface PublishResult {
  id: string;
  title: string;
  portalToken: string;
  portalTokenExpiresAt: string;
  portalUrl: string;
  expiresAt: string;
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

export const reportsApi = {
  list: (params: { page?: number; search?: string } = {}) =>
    api<{ data: ReportSummary[]; total: number; totalPages: number }>(
      `/reports${qs(params)}`,
    ),

  get: (id: string) => api<ReportDetail>(`/reports/${id}`),

  create: (data: {
    title: string;
    auditIds?: string[];
    blocks?: ReportBlock[];
  }) => api<ReportSummary>('/reports', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: { title?: string; blocks?: ReportBlock[] }) =>
    api<ReportDetail>(`/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  publish: (id: string, ttlDays = 30) =>
    api<PublishResult>(`/reports/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify({ ttlDays }),
    }),

  unpublish: (id: string) =>
    api<void>(`/reports/${id}/unpublish`, { method: 'POST' }),

  delete: (id: string) =>
    api<void>(`/reports/${id}`, { method: 'DELETE' }),

  // Public portal — no auth cookie needed
  getPortal: (token: string) =>
    fetch(`${API}/api/reports/portal/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 403 ? 'expired' : 'not_found');
        return r.json() as Promise<ReportDetail>;
      }),
};
