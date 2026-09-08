'use client';
// apps/web/components/auth/auth-provider.tsx

import { AuthContext, useAuthState } from '../../lib/use-auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuthState();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}
