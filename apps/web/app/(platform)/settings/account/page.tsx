'use client';
// apps/web/app/(platform)/settings/account/page.tsx

import { useState, useEffect, FormEvent } from 'react';

interface Me {
  id: string;
  email: string;
  displayName: string;
  role: string;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
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

export default function AccountSettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Me>('/auth/me')
      .then(setMe)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-surface-500">Loading…</p>;
  }
  if (!me) {
    return <p className="text-sm text-red-400">Failed to load account info.</p>;
  }

  return (
    <div className="space-y-6">

      {/* Profile section */}
      <SettingsCard title="Profile">
        <ProfileForm me={me} onUpdate={setMe} />
      </SettingsCard>

      {/* Password section */}
      <SettingsCard title="Change password">
        <PasswordForm />
      </SettingsCard>

      {/* Session info */}
      <SettingsCard title="Sessions">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-surface-200">Email</p>
              <p className="text-xs text-surface-500">{me.email}</p>
            </div>
            {me.emailVerifiedAt ? (
              <span className="rounded bg-emerald-950 px-2 py-0.5 text-xs text-emerald-400">
                Verified
              </span>
            ) : (
              <span className="rounded bg-yellow-950 px-2 py-0.5 text-xs text-yellow-400">
                Unverified
              </span>
            )}
          </div>
          {me.lastLoginAt && (
            <p className="text-xs text-surface-500">
              Last login: {new Date(me.lastLoginAt).toLocaleString()}
            </p>
          )}
          <LogoutAllButton />
        </div>
      </SettingsCard>

    </div>
  );
}

// ── Profile form ──────────────────────────────────────────────────────

function ProfileForm({ me, onUpdate }: { me: Me; onUpdate: (m: Me) => void }) {
  const [displayName, setDisplayName] = useState(me.displayName);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const updated = await apiFetch<Me>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ displayName }),
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
      <Field label="Display name">
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          minLength={2}
          className={INPUT}
        />
      </Field>
      <Field label="Role">
        <p className="py-2 text-sm text-surface-300 capitalize">
          {me.role.toLowerCase().replace('_', ' ')}
        </p>
      </Field>
      {error   && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-emerald-400">Saved ✓</p>}
      <button type="submit" disabled={saving} className={BTN_PRIMARY}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}

// ── Password form ─────────────────────────────────────────────────────

function PasswordForm() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await apiFetch('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword:     form.newPassword,
        }),
      });
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message ?? 'Failed to change password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Current password">
        <input type="password" value={form.currentPassword} onChange={(e) => set('currentPassword', e.target.value)} required className={INPUT} />
      </Field>
      <Field label="New password">
        <input type="password" value={form.newPassword} onChange={(e) => set('newPassword', e.target.value)} required minLength={8} className={INPUT} />
      </Field>
      <Field label="Confirm new password">
        <input type="password" value={form.confirm} onChange={(e) => set('confirm', e.target.value)} required minLength={8} className={INPUT} />
      </Field>
      {error   && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-emerald-400">Password changed ✓</p>}
      <button type="submit" disabled={saving} className={BTN_PRIMARY}>
        {saving ? 'Saving…' : 'Change password'}
      </button>
    </form>
  );
}

// ── Logout all devices ────────────────────────────────────────────────

function LogoutAllButton() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleLogoutAll() {
    if (!confirm('Log out from all devices? You will need to log in again.')) return;
    setLoading(true);
    try {
      await apiFetch('/auth/logout-all', { method: 'POST' });
      setDone(true);
      setTimeout(() => { window.location.href = '/login'; }, 1500);
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleLogoutAll}
      disabled={loading || done}
      className="rounded-md border border-surface-600 px-3 py-1.5 text-sm text-surface-300 hover:bg-surface-800 disabled:opacity-60 transition"
    >
      {done ? 'Logged out — redirecting…' : loading ? 'Logging out…' : 'Log out all devices'}
    </button>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────

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
