'use client';
// apps/web/app/(public)/reset-password/page.tsx

import { useState, FormEvent, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authApi, ApiClientError } from '../../../lib/api';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) setError('Invalid reset link. Please request a new one.');
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold tracking-tight text-gold-500">FSTail</span>
          <span className="ml-1 text-2xl font-light text-surface-300">Platform</span>
        </div>

        <div className="rounded-lg border border-surface-700 bg-surface-800 p-8">
          {done ? (
            <div className="text-center">
              <div className="mb-3 text-2xl">✅</div>
              <h2 className="mb-2 text-base font-semibold text-surface-50">Password changed</h2>
              <p className="text-sm text-surface-400">Redirecting to login…</p>
            </div>
          ) : (
            <>
              <h1 className="mb-6 text-lg font-semibold text-surface-50">Set a new password</h1>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-300">
                    New password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-surface-50 outline-none transition focus:border-gold-500 focus:ring-1 focus:ring-gold-500"
                    placeholder="Min. 8 characters"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-300">
                    Confirm password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full rounded-md border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-surface-50 outline-none transition focus:border-gold-500 focus:ring-1 focus:ring-gold-500"
                    placeholder="Repeat password"
                  />
                </div>

                {error && (
                  <p className="rounded-md bg-red-950 px-3 py-2 text-sm text-red-400">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !token}
                  className="w-full rounded-md bg-gold-500 px-4 py-2 text-sm font-semibold text-surface-900 hover:bg-gold-400 disabled:opacity-60"
                >
                  {loading ? 'Saving…' : 'Change password'}
                </button>
              </form>
              <Link href="/login" className="mt-4 block text-center text-xs text-surface-500 hover:text-surface-400">
                ← Back to login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
