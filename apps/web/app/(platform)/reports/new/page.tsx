'use client';
// apps/web/app/(platform)/reports/new/page.tsx

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { reportsApi } from '../../../../lib/reports-api';

interface AuditOption {
  id: string;
  title: string;
  status: string;
  finalScore: number | null;
  client: { name: string } | null;
}

export default function NewReportPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [audits, setAudits] = useState<AuditOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingAudits, setLoadingAudits] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/audits?pageSize=100&status=DONE`,
      { credentials: 'include' },
    )
      .then((r) => r.json())
      .then((data) => {
        setAudits(data.data ?? []);
        setLoadingAudits(false);
      })
      .catch(() => setLoadingAudits(false));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    try {
      const report = await reportsApi.create({
        title: title.trim(),
        auditIds: selected.size > 0 ? Array.from(selected) : undefined,
      });
      router.push(`/reports/${report.id}`);
    } catch (err: any) {
      setError(err.message ?? 'Failed to create report');
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-surface-700 px-6 py-4">
        <Link href="/reports" className="text-sm text-surface-500 hover:text-surface-300">
          ← Reports
        </Link>
        <span className="text-surface-600">/</span>
        <h1 className="text-lg font-semibold text-surface-50">New report</h1>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-6">

          {/* Title */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-300">
              Report title *
            </label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Q1 2025 Web Audit — Acme Corp"
              className="w-full rounded-md border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-surface-50 placeholder-surface-500 outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500"
            />
          </div>

          {/* Audit picker */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-300">
              Include audits{' '}
              <span className="font-normal text-surface-500">(optional — DONE audits only)</span>
            </label>

            {loadingAudits ? (
              <p className="text-sm text-surface-500">Loading audits…</p>
            ) : audits.length === 0 ? (
              <p className="text-sm text-surface-500">
                No completed audits found.{' '}
                <Link href="/audit" className="text-gold-500 hover:text-gold-400">
                  Go to audits →
                </Link>
              </p>
            ) : (
              <div className="max-h-64 space-y-1.5 overflow-auto rounded-md border border-surface-700 bg-surface-900 p-2">
                {audits.map((audit) => (
                  <label
                    key={audit.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-800 transition"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(audit.id)}
                      onChange={() => toggle(audit.id)}
                      className="accent-gold-500"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-surface-100 truncate">
                        {audit.title}
                      </span>
                      {audit.client && (
                        <span className="text-xs text-surface-500">{audit.client.name}</span>
                      )}
                    </span>
                    {audit.finalScore !== null && (
                      <span className="text-sm font-bold font-mono text-gold-400 tabular-nums">
                        {audit.finalScore}/10
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}

            {selected.size > 0 && (
              <p className="mt-1.5 text-xs text-surface-400">
                {selected.size} audit{selected.size !== 1 ? 's' : ''} selected —
                content blocks will be generated automatically.
              </p>
            )}
          </div>

          {error && (
            <p className="rounded-md bg-red-950 px-3 py-2 text-sm text-red-400">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-gold-500 px-4 py-2 text-sm font-semibold text-surface-900 hover:bg-gold-400 disabled:opacity-60 transition"
            >
              {saving ? 'Creating…' : 'Create report'}
            </button>
            <Link
              href="/reports"
              className="rounded-md border border-surface-600 px-4 py-2 text-sm text-surface-300 hover:bg-surface-800 transition"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
