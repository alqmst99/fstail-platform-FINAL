'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clientsApi, projectsApi, type Client } from '../../../../../lib/crm-api';

const INPUT =
  'w-full rounded-md border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-surface-50 placeholder-surface-500 outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500';

export default function NewProjectPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState('ACTIVE');

  useEffect(() => {
    clientsApi
      .list({ pageSize: 100 })
      .then((r) => setClients(r.data || []))
      .catch(() => setClients([]));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const project = await projectsApi.create({
        title,
        description: description || undefined,
        clientId: clientId || undefined,
        status: status as any,
      });
      router.push(`/crm/projects/${project.id}`);
    } catch (err: any) {
      setError(err.message || 'No se pudo crear el proyecto');
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-surface-700 px-4 py-4 sm:px-6">
        <Link href="/crm/projects" className="text-sm text-surface-500 hover:text-surface-300">
          ← Projects
        </Link>
        <span className="text-surface-600">/</span>
        <h1 className="text-lg font-semibold text-surface-50">New project</h1>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-300">Title *</label>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT} placeholder="Website redesign" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-300">Client</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={INPUT}>
              <option value="">Sin cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-300">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={INPUT}>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On hold</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-300">Description</label>
            <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className={INPUT} placeholder="Notas del proyecto…" />
          </div>
          {error && <p className="rounded-md bg-red-950 px-3 py-2 text-sm text-red-400">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-gold-500 px-4 py-2 text-sm font-semibold text-surface-900 hover:bg-gold-400 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Create project'}
            </button>
            <Link href="/crm/projects" className="rounded-md border border-surface-600 px-4 py-2 text-sm text-surface-300 hover:bg-surface-800">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
