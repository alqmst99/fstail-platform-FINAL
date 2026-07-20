// apps/web/lib/api.ts
// Typed fetch wrapper for the NestJS API.
// Cookies are sent automatically (credentials: 'include').
// On 401, attempts one silent token refresh before throwing.

import type { ApiError } from '@fstail/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiClientError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string | string[],
    public readonly error?: string,
  ) {
    super(Array.isArray(message) ? message.join(', ') : message);
    this.name = 'ApiClientError';
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  skipRefresh?: boolean; // internal — prevents infinite refresh loop
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipRefresh, ...fetchOptions } = options;

  const res = await fetch(`${API_URL}/api${path}`, {
    ...fetchOptions,
    credentials: 'include', // sends HttpOnly cookies automatically
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
    body: body !== undefined ? JSON.stringify(body) : null,
  });

  // Transparent token refresh on 401
  if (res.status === 401 && !skipRefresh) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, { ...options, skipRefresh: true });
    }
    // Refresh failed — redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new ApiClientError(401, 'Session expired');
  }

  if (!res.ok) {
    const errBody: ApiError = await res.json().catch(() => ({
      statusCode: res.status,
      message: res.statusText,
    }));
    throw new ApiClientError(errBody.statusCode, errBody.message, errBody.error);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Auth endpoints ────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    request<{ message: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  register: (data: { email: string; password: string; displayName: string; workspaceSlug?: string }) =>
    request<{ message: string; user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: data,
    }),

  logout: () =>
    request<{ message: string }>('/auth/logout', { method: 'POST' }),

  logoutAll: () =>
    request<{ message: string }>('/auth/logout-all', { method: 'POST' }),

  me: () =>
    request<AuthUser>('/auth/me'),

  verifyEmail: (token: string) =>
    request<{ message: string }>('/auth/verify-email', {
      method: 'POST',
      body: { token },
    }),

  resendVerification: () =>
    request<{ message: string }>('/auth/resend-verification', { method: 'POST' }),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: { email },
    }),

  resetPassword: (token: string, password: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: { token, password },
    }),
};

// ── Type helpers (mirrors @fstail/types until the package is linked) ──

interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  workspaceId: string | null;
}

export type { AuthUser };
