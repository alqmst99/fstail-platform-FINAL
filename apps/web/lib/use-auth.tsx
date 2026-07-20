'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
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
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: false,        // ← cambiado a false
    error: null,
  });

  const login = useCallback(async (email: string, password: string) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const { user } = await authApi.login(email, password);
      setState({ user, loading: false, error: null });
    } catch (err: any) {
      const message = err?.message || 'Login failed';
      setState(s => ({ ...s, loading: false, error: message }));
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    setState({ user: null, loading: false, error: null });
    window.location.href = '/login';
  }, []);

  const clearError = useCallback(() => {
    setState(s => ({ ...s, error: null }));
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const user = await authApi.me();
      setState({ user, loading: false, error: null });
    } catch {
      setState({ user: null, loading: false, error: null });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, clearError, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}