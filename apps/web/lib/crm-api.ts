// apps/web/lib/crm-api.ts
// Typed wrappers for the CRM endpoints.
// All calls go through the base request() in api.ts (auth, cookie, refresh handled there).

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type ClientStatus = 'LEAD' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  status: ClientStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { projects: number; audits: number };
}

export interface ClientDetail extends Client {
  projects: { id: string; title: string; status: ProjectStatus; createdAt: string }[];
  audits: { id: string; title: string; status: string; finalScore: number | null; createdAt: string }[];
}

export interface Project {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string; status: ClientStatus } | null;
  _count: { audits: number };
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ClientStats {
  total: number;
  leads: number;
  active: number;
  inactive: number;
  archived: number;
}

// ── helpers ──────────────────────────────────────────────────────────

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

// ── Clients ───────────────────────────────────────────────────────────

export const clientsApi = {
  list: (params: { page?: number; pageSize?: number; search?: string; status?: ClientStatus } = {}) =>
    api<Paginated<Client>>(`/clients${qs(params)}`),

  stats: () => api<ClientStats>('/clients/stats'),

  get: (id: string) => api<ClientDetail>(`/clients/${id}`),

  create: (data: { name: string; email?: string; phone?: string; website?: string; status?: ClientStatus; notes?: string }) =>
    api<Client>('/clients', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<Parameters<typeof clientsApi.create>[0]>) =>
    api<Client>(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) => api<void>(`/clients/${id}`, { method: 'DELETE' }),
};

// ── Projects ──────────────────────────────────────────────────────────

export const projectsApi = {
  list: (params: { page?: number; pageSize?: number; search?: string; status?: ProjectStatus; clientId?: string } = {}) =>
    api<Paginated<Project>>(`/projects${qs(params)}`),

  stats: () => api<Record<string, number>>('/projects/stats'),

  get: (id: string) => api<Project & { audits: any[] }>(`/projects/${id}`),

  create: (data: { title: string; description?: string; clientId?: string; status?: ProjectStatus }) =>
    api<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<Parameters<typeof projectsApi.create>[0]>) =>
    api<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string) => api<void>(`/projects/${id}`, { method: 'DELETE' }),
};
