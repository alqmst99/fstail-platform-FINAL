'use client';
// apps/web/app/(platform)/settings/workspace/page.tsx

import { useState, useEffect, FormEvent } from 'react';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
  ownerId: string;
  owner: { id: string; displayName: string; email: string };
  settings: Record<string, unknown>;
  _count: { users: number; clients: number; audits: number };
}

interface Stats {
  plan: string;
  totals: Record<string, number>;
  last30Days: { audits: number; radarScans: number };
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message ?? res.statusText);
  }
  return res.json();
}

export default function WorkspaceSettingsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<Workspace>('/workspaces/me'),
      apiFetch<Stats>('/workspaces/me/stats'),
    ]).then(([ws, st]) => {
      setWorkspace(ws);
      setStats(st);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-surface-500">Loading…</p>;
  if (!workspace) return <p className="text-sm text-red-400">Failed to load workspace.</p>;

  return (
    <div className="space-y-6">

      {/* Workspace info form */}
      <SettingsCard title="Workspace">
        <WorkspaceForm workspace={workspace} onUpdate={setWorkspace} />
      </SettingsCard>

      {/* Usage stats */}
      {stats && (
        <SettingsCard title="Usage">
          <UsageStats stats={stats} />
        </SettingsCard>
      )}

      {/* Transfer ownership */}
      <SettingsCard title="Ownership">
        <div className="space-y-3">
          <p className="text-sm text-surface-300">
            Current owner:{' '}
            <span className="font-medium text-surface-100">
              {workspace.owner.displayName}
            </span>
            {' '}
            <span className="text-surface-500">({workspace.owner.email})</span>
          </p>
          <p className="text-xs text-surface-500">
            Transferring ownership promotes the new owner to Admin and cannot be undone without their cooperation.
          </p>
          <TransferOwnershipForm workspaceId={workspace.id} />
        </div>
      </SettingsCard>

    </div>
  );
}

// ── Workspace form ────────────────────────────────────────────────────

function WorkspaceForm({
  workspace,
  onUpdate,
}: {
  workspace: Workspace;
  onUpdate: (w: Workspace) => void;
}) {
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const updated = await apiFetch<Workspace>('/workspaces/me', {
        method: 'PATCH',
        body: JSON.stringify({ name, slug }),
      });
      onUpdate(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Workspace name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          className={INPUT}
        />
      </Field>
      <Field label="Slug">
        <div className="flex items-center gap-2">
          <span className="text-sm text-surface-500">fstailsolutions.com.ar/</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            required
            pattern="[a-z0-9-]+"
            className={INPUT}
          />
        </div>
        <p className="mt-1 text-xs text-surface-500">
          Lowercase letters, numbers, and hyphens only.
        </p>
      </Field>
      <div className="flex items-center gap-2">
        <span className="rounded bg-surface-700 px-2 py-0.5 text-xs text-surface-300 capitalize">
          {workspace.plan.toLowerCase()} plan
        </span>
      </div>
      {error   && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-emerald-400">Saved ✓</p>}
      <button type="submit" disabled={saving} className={BTN_PRIMARY}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}

// ── Usage stats ───────────────────────────────────────────────────────

function UsageStats({ stats }: { stats: Stats }) {
  const items = [
    { label: 'Users',      value: stats.totals['users']      ?? 0 },
    { label: 'Clients',    value: stats.totals['clients']    ?? 0 },
    { label: 'Projects',   value: stats.totals['projects']   ?? 0 },
    { label: 'Audits',     value: stats.totals['audits']     ?? 0 },
    { label: 'Radar scans',value: stats.totals['radarScans'] ?? 0 },
    { label: 'Proposals',  value: stats.totals['proposals']  ?? 0 },
    { label: 'Reports',    value: stats.totals['reports']    ?? 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map(({ label, value }) => (
          <div key={label} className="rounded-md bg-surface-900 px-3 py-2.5">
            <p className="text-xl font-bold tabular-nums text-surface-50">{value}</p>
            <p className="text-xs text-surface-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
      <div className="rounded-md border border-surface-700 bg-surface-900/50 px-4 py-3">
        <p className="text-xs font-medium text-surface-400 mb-2">Last 30 days</p>
        <div className="flex gap-6">
          <div>
            <p className="text-lg font-bold text-gold-400">{stats.last30Days.audits}</p>
            <p className="text-xs text-surface-500">Audits</p>
          </div>
          <div>
            <p className="text-lg font-bold text-gold-400">{stats.last30Days.radarScans}</p>
            <p className="text-xs text-surface-500">Radar scans</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Transfer ownership ────────────────────────────────────────────────

function TransferOwnershipForm({ workspaceId }: { workspaceId: string }) {
  const [newOwnerId, setNewOwnerId] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!confirm('Transfer workspace ownership? This cannot be undone easily.')) return;
    setSaving(true);
    setError('');
    try {
      const result = await apiFetch<{ message: string }>('/workspaces/me/transfer', {
        method: 'POST',
        body: JSON.stringify({ newOwnerId }),
      });
      setSuccess(result.message);
      setNewOwnerId('');
    } catch (err: any) {
      setError(err.message ?? 'Transfer failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Field label="New owner user ID">
        <input
          value={newOwnerId}
          onChange={(e) => setNewOwnerId(e.target.value)}
          placeholder="UUID of the new owner"
          className={INPUT}
          pattern="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
        />
      </Field>
      {error   && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-emerald-400">{success} ✓</p>}
      <button
        type="submit"
        disabled={saving || !newOwnerId}
        className="rounded-md border border-red-900 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950 disabled:opacity-60 transition"
      >
        {saving ? 'Transferring…' : 'Transfer ownership'}
      </button>
    </form>
  );
}

// ── Shared ────────────────────────────────────────────────────────────

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-surface-700 bg-surface-800">
      <div className="border-b border-surface-700 px-5 py-3">
        <h2 className="text-sm font-semibold text-surface-200">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-surface-300">{label}</label>
      {children}
    </div>
  );
}

const INPUT = 'w-full rounded-md border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-surface-50 placeholder-surface-500 outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500';
const BTN_PRIMARY = 'rounded-md bg-gold-500 px-4 py-2 text-sm font-semibold text-surface-900 hover:bg-gold-400 disabled:opacity-60 transition';
