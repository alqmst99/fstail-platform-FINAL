'use client';
// apps/web/app/(platform)/crm/clients/new/page.tsx

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clientsApi } from '../../../../../lib/crm-api';

const STATUS_OPTIONS = [
  { value: 'LEAD',     label: 'Lead'     },
  { value: 'ACTIVE',   label: 'Active'   },
  { value: 'INACTIVE', label: 'Inactive' },
];

export default function NewClientPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
    status: 'LEAD' as const,
    notes: '',
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const client = await clientsApi.create({
        ...form,
        email: form.email || undefined,
        phone: form.phone || undefined,
        website: form.website || undefined,
        notes: form.notes || undefined,
      });
      router.push(`/crm/clients/${client.id}`);
    } catch (err: any) {
      setError(err.message ?? 'Failed to create client');
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col">

      <div className="flex items-center gap-3 border-b border-surface-700 px-6 py-4">
        <Link href="/crm/clients" className="text-surface-500 hover:text-surface-300 text-sm">
          ← Clients
        </Link>
        <span className="text-surface-600">/</span>
        <h1 className="text-lg font-semibold text-surface-50">New client</h1>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-5">

          <Field label="Name *">
            <input
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className={INPUT}
              placeholder="Acme Corp"
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              className={INPUT}
              placeholder="contact@acme.com"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone">
              <input
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                className={INPUT}
                placeholder="+54 11 1234-5678"
              />
            </Field>
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
                className={INPUT}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Website">
            <input
              type="url"
              value={form.website}
              onChange={(e) => set('website', e.target.value)}
              className={INPUT}
              placeholder="https://acme.com"
            />
          </Field>

          <Field label="Notes">
            <textarea
              rows={4}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              className={INPUT}
              placeholder="How did you meet? Any context…"
            />
          </Field>

          {error && (
            <p className="rounded-md bg-red-950 px-3 py-2 text-sm text-red-400">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-gold-500 px-4 py-2 text-sm font-semibold text-surface-900 hover:bg-gold-400 disabled:opacity-60 transition"
            >
              {saving ? 'Saving…' : 'Create client'}
            </button>
            <Link
              href="/crm/clients"
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

// ── Local helpers ─────────────────────────────────────────────────────

const INPUT = [
  'w-full rounded-md border border-surface-600 bg-surface-900',
  'px-3 py-2 text-sm text-surface-50 placeholder-surface-500',
  'outline-none transition focus:border-gold-500 focus:ring-1 focus:ring-gold-500',
].join(' ');

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-surface-300">{label}</label>
      {children}
    </div>
  );
}
