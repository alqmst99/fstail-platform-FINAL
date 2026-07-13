'use client';
// apps/web/app/(public)/forgot-password/page.tsx

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { authApi } from '../../../lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
    } finally {
      // Always show success — never reveal if email exists
      setLoading(false);
      setSubmitted(true);
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
          {submitted ? (
            <div className="text-center">
              <div className="mb-3 text-2xl">📬</div>
              <h2 className="mb-2 text-base font-semibold text-surface-50">Check your email</h2>
              <p className="text-sm text-surface-400">
                If that address is registered, we&apos;ve sent a reset link. It expires in 1 hour.
              </p>
              <Link
                href="/login"
                className="mt-6 block text-sm text-gold-500 hover:text-gold-400"
              >
                ← Back to login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="mb-2 text-lg font-semibold text-surface-50">Reset your password</h1>
              <p className="mb-6 text-sm text-surface-400">
                Enter your email and we&apos;ll send a reset link.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-surface-50 outline-none transition focus:border-gold-500 focus:ring-1 focus:ring-gold-500"
                  placeholder="you@fstailsolutions.com.ar"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-md bg-gold-500 px-4 py-2 text-sm font-semibold text-surface-900 hover:bg-gold-400 disabled:opacity-60"
                >
                  {loading ? 'Sending…' : 'Send reset link'}
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
