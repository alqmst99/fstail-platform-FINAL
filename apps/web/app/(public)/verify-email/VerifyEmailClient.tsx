'use client';
// apps/web/app/(public)/verify-email/page.tsx

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authApi, ApiClientError } from '../../../lib/api';

export default function VerifyEmailClient(){
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link.');
      return;
    }

    authApi
      .verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof ApiClientError ? err.message : 'Verification failed.');
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-900 px-4">
      <div className="w-full max-w-sm rounded-lg border border-surface-700 bg-surface-800 p-8 text-center">
        {status === 'pending' && (
          <>
            <div className="mb-3 text-2xl animate-pulse">⏳</div>
            <p className="text-sm text-surface-400">Verifying your email…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mb-3 text-2xl">✅</div>
            <h2 className="mb-2 text-base font-semibold text-surface-50">Email verified</h2>
            <p className="mb-6 text-sm text-surface-400">Your account is now fully active.</p>
            <Link
              href="/login"
              className="inline-block rounded-md bg-gold-500 px-4 py-2 text-sm font-semibold text-surface-900 hover:bg-gold-400"
            >
              Sign in
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mb-3 text-2xl">❌</div>
            <h2 className="mb-2 text-base font-semibold text-surface-50">Verification failed</h2>
            <p className="mb-6 text-sm text-surface-400">{message}</p>
            <Link href="/login" className="text-sm text-gold-500 hover:text-gold-400">
              ← Back to login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
