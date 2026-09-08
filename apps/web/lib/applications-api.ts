const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, ...fetchOptions } = options;
  const res = await fetch(`${API_URL}/api${path}`, {
    ...fetchOptions,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const msg = Array.isArray(err.message) ? err.message.join(', ') : err.message || res.statusText;
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const applicationsApi = {
  stats: (assignedTo?: string) => {
    const qs = assignedTo ? `?assignedTo=${encodeURIComponent(assignedTo)}` : '';
    return request<any>(`/applications/stats${qs}`);
  },
  freelancerHistory: (refresh = true) =>
    request<any>(`/applications/freelancer-history?refresh=${refresh ? 'true' : 'false'}`),
  list: (q?: { status?: string; assignedTo?: string }) => {
    const params = new URLSearchParams();
    if (q?.status) params.set('status', q.status);
    if (q?.assignedTo) params.set('assignedTo', q.assignedTo);
    const qs = params.toString();
    return request<{ data: any[]; total: number }>(`/applications${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => request<any>(`/applications/${id}`),
  create: (body: Record<string, unknown>) =>
    request<any>('/applications', { method: 'POST', body }),
  addMessage: (id: string, text: string, sender: 'me' | 'client' = 'me') =>
    request<any>(`/applications/${id}/messages`, {
      method: 'POST',
      body: { text, sender },
    }),
  updateStatus: (id: string, status: string, extra?: Record<string, unknown>) =>
    request<any>(`/applications/${id}/status`, {
      method: 'PATCH',
      body: { status, ...extra },
    }),
  syncFreelancer: () =>
    request<{ imported: number; won: number; lost: number; pending: number; totalRaw: number }>(
      '/applications/sync-freelancer',
      { method: 'POST' },
    ),
};

export const dailyTasksApi = {
  list: (userTag: string, date?: string) => {
    const params = new URLSearchParams({ userTag });
    if (date) params.set('date', date);
    return request<any[]>(`/daily-tasks?${params}`);
  },
  listRange: (userTag: string, from: string, to: string) =>
    request<any[]>(
      `/daily-tasks/range?userTag=${encodeURIComponent(userTag)}&from=${from}&to=${to}`,
    ),
  create: (body: Record<string, unknown>) =>
    request<any>('/daily-tasks', { method: 'POST', body }),
  update: (id: string, body: Record<string, unknown>) =>
    request<any>(`/daily-tasks/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => request<void>(`/daily-tasks/${id}`, { method: 'DELETE' }),
  routineContext: (userTag: string) =>
    request<Record<string, unknown>>(
      `/daily-tasks/routine-context?userTag=${encodeURIComponent(userTag)}`,
    ),
  importRoutine: (body: {
    userTag: string;
    tasks: Array<{ title: string; category?: string; timeSpentMin?: number }>;
    energyLevel?: number;
    replaceToday?: boolean;
    date?: string;
  }) => request<{ imported: number }>('/daily-tasks/import-routine', { method: 'POST', body }),
  importRoutineWeek: (body: {
    userTag: string;
    tasks?: Array<{ title: string; category?: string; timeSpentMin?: number; date?: string }>;
    days?: Record<string, Array<{ title: string; category?: string; timeSpentMin?: number }>>;
    energyLevel?: number;
    replaceWeek?: boolean;
    weekStart?: string;
  }) =>
    request<{ imported: number; dates?: string[] }>('/daily-tasks/import-routine-week', {
      method: 'POST',
      body,
    }),
};
