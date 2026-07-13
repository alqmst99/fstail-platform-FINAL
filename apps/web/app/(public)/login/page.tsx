'use client';
// apps/web/app/(public)/login/page.tsx

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../lib/use-auth';
import type { Metadata } from 'next';

export default function LoginPage() {
  const { login, loading, error, clearError } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    try {
      await login(email, password);
      router.push('/radar'); // Default landing after login
    } catch {
      // Error already set in useAuth
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-900 px-4">
      <div className="w-full max-w-sm">

        {/* Logo / wordmark */}
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold tracking-tight text-gold-500">
            FSTail
          </span>
          <span className="ml-1 text-2xl font-light text-surface-300">
            Platform
          </span>
        </div>

        <div className="rounded-lg border border-surface-700 bg-surface-800 p-8">
          <h1 className="mb-6 text-lg font-semibold text-surface-50">
            Sign in to your account
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-surface-300"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-surface-50 placeholder-surface-500 outline-none transition focus:border-gold-500 focus:ring-1 focus:ring-gold-500"
                placeholder="you@fstailsolutions.com.ar"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-surface-300"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-gold-500 hover:text-gold-400"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-surface-50 placeholder-surface-500 outline-none transition focus:border-gold-500 focus:ring-1 focus:ring-gold-500"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-md bg-red-950 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-gold-500 px-4 py-2 text-sm font-semibold text-surface-900 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-surface-500">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-gold-500 hover:text-gold-400">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
