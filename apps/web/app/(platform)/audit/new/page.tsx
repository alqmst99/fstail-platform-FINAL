// apps/web/app/(platform)/audit/new/page.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewAuditPage() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function createAudit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError('');

    try {
      const API =
        process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

      const res = await fetch(`${API}/api/audits`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          clientId: clientId || undefined,
          projectId: projectId || undefined,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to create audit');
      }

      const audit = await res.json();

      router.push(`/audit/${audit.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-8">

      <h1 className="mb-6 text-2xl font-bold">
        Create Audit
      </h1>

      <form onSubmit={createAudit} className="space-y-5">

        <div>
          <label className="mb-1 block text-sm">
            Title
          </label>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded border p-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm">
            Client ID
          </label>

          <input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full rounded border p-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm">
            Project ID
          </label>

          <input
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full rounded border p-2"
          />
        </div>

        {error && (
          <div className="rounded bg-red-100 p-3 text-red-700">
            {error}
          </div>
        )}

        <button
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          {loading ? 'Creating...' : 'Create Audit'}
        </button>

      </form>

    </div>
  );
}