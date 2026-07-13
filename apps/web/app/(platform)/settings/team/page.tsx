'use client';
// apps/web/app/(platform)/settings/team/page.tsx

import { useState, useEffect, FormEvent } from 'react';

interface Member {
  id: string;
  email: string;
  displayName: string;
  role: string;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const ROLES = ['ANALYST', 'ADMIN', 'CLIENT'] as const;

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
  if (res.status === 204) return undefined as T;
  return res.json();
}

export default function TeamSettingsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);

  async function loadMembers() {
    const [membersData, meData] = await Promise.all([
      apiFetch<{ data: Member[] }>('/users'),
      apiFetch<{ id: string; role: string }>('/auth/me'),
    ]);
    setMembers(membersData.data);
    setMe(meData);
  }

  useEffect(() => {
    loadMembers().finally(() => setLoading(false));
  }, []);

  const isAdmin = me?.role === 'ADMIN' || me?.role === 'SUPER_ADMIN';

  async function handleRoleChange(userId: string, role: string) {
    try {
      await apiFetch(`/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      await loadMembers();
    } catch (err: any) {
      alert(err.message ?? 'Failed to update role');
    }
  }

  async function handleDeactivate(userId: string, displayName: string) {
    if (!confirm(`Deactivate ${displayName}? They will be logged out immediately.`)) return;
    try {
      await apiFetch(`/users/${userId}`, { method: 'DELETE' });
      await loadMembers();
    } catch (err: any) {
      alert(err.message ?? 'Failed to deactivate user');
    }
  }

  if (loading) return <p className="text-sm text-surface-500">Loading…</p>;

  return (
    <div className="space-y-6">

      {/* Member list */}
      <SettingsCard title={`Team members (${members.length})`}>
        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-md border border-surface-700 bg-surface-900 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-surface-100 truncate">
                  {m.displayName}
                  {m.id === me?.id && (
                    <span className="ml-2 text-xs text-surface-500">(you)</span>
                  )}
                </p>
                <p className="text-xs text-surface-500 truncate">{m.email}</p>
                {!m.emailVerifiedAt && (
                  <span className="text-xs text-yellow-500">Unverified email</span>
                )}
              </div>

              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                {/* Role selector */}
                {isAdmin && m.id !== me?.id && m.role !== 'SUPER_ADMIN' ? (
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.id, e.target.value)}
                    className="rounded border border-surface-600 bg-surface-800 px-2 py-1 text-xs text-surface-200 outline-none focus:border-gold-500"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0) + r.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="rounded bg-surface-700 px-2 py-0.5 text-xs text-surface-400 capitalize">
                    {m.role.toLowerCase().replace('_', ' ')}
                  </span>
                )}

                {/* Deactivate */}
                {isAdmin && m.id !== me?.id && m.role !== 'SUPER_ADMIN' && (
                  <button
                    onClick={() => handleDeactivate(m.id, m.displayName)}
                    className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-950 transition"
                    title="Deactivate"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* Invite form */}
      {isAdmin && (
        <SettingsCard title="Invite team member">
          <InviteForm onInvited={loadMembers} />
        </SettingsCard>
      )}
    </div>
  );
}

// ── Invite form ───────────────────────────────────────────────────────

function InviteForm({ onInvited }: { onInvited: () => void }) {
  const [form, setForm] = useState({ email: '', displayName: '', role: 'ANALYST' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await apiFetch('/users/invite', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm({ email: '', displayName: '', role: 'ANALYST' });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
      onInvited();
    } catch (err: any) {
      setError(err.message ?? 'Invite failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Email">
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="teammate@example.com"
          className={INPUT}
        />
      </Field>
      <Field label="Display name">
        <input
          required
          value={form.displayName}
          onChange={(e) => set('displayName', e.target.value)}
          placeholder="Ana Clara"
          className={INPUT}
        />
      </Field>
      <Field label="Role">
        <select
          value={form.role}
          onChange={(e) => set('role', e.target.value)}
          className={INPUT}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.charAt(0) + r.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </Field>
      {error   && <p className="text-sm text-red-400">{error}</p>}
      {success && (
        <p className="text-sm text-emerald-400">
          Invite sent! They will receive a password setup email. ✓
        </p>
      )}
      <button type="submit" disabled={saving} className={BTN_PRIMARY}>
        {saving ? 'Inviting…' : 'Send invite'}
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
