'use client';
// apps/web/lib/use-auth.ts
// Lightweight auth hook — no external auth library needed.
// State lives in React context (see AuthProvider below).

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, type AuthUser } from './api';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function useAuthState() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  // Fetch session on mount — determines if user is already logged in
  useEffect(() => {
    authApi
      .me()
      .then((user) => setState({ user, loading: false, error: null }))
      .catch(() => setState({ user: null, loading: false, error: null }));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { user } = await authApi.login(email, password);
      setState({ user, loading: false, error: null });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setState((s) => ({ ...s, loading: false, error: message }));
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    setState({ user: null, loading: false, error: null });
    window.location.href = '/login';
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  return { ...state, login, logout, clearError };
}
