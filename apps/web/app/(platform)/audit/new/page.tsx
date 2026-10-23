// apps/web/app/(platform)/audit/new/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientsApi, projectsApi, type Client, type Project } from '../../../../lib/crm-api';
import { request } from '../../../../lib/api';

export default function NewAuditPage() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      clientsApi.list({ page: 1, pageSize: 100 }),
      projectsApi.list({ page: 1, pageSize: 100 }),
    ]).then(([clientResult, projectResult]) => {
      setClients(clientResult.data);
      setProjects(projectResult.data);
    }).catch(() => setError('No se pudieron cargar clientes y proyectos. Podés crear el audit sin vincularlos.'))
      .finally(() => setLoadingOptions(false));
  }, []);

  async function createAudit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError('');

    try {
      const audit = await request<any>('/audits', {
        method: 'POST',
        body: {
          title,
          clientId: clientId || undefined,
          projectId: projectId || undefined,
        },
      });

      router.push(`/audit/${audit.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-8">

      <h1 className="mb-6 text-2xl font-bold text-surface-50">
        Create Audit
      </h1>

      <form onSubmit={createAudit} className="space-y-5">

        <div>
          <label className="mb-1.5 block text-sm font-medium text-surface-300">
            Title
          </label>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-md border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-surface-50 placeholder:text-surface-500 outline-none focus:border-gold-500"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-surface-300">Cliente (opcional)</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={loadingOptions} className="w-full rounded-md border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-surface-50 placeholder:text-surface-500 outline-none focus:border-gold-500">
            <option value="">Sin cliente</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-surface-300">Proyecto (opcional)</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={loadingOptions} className="w-full rounded-md border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-surface-50 placeholder:text-surface-500 outline-none focus:border-gold-500">
            <option value="">Sin proyecto</option>
            {projects.filter((project) => !clientId || project.client?.id === clientId).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
          </select>
        </div>

        {error && (
          <div className="rounded bg-red-100 p-3 text-red-700">
            {error}
          </div>
        )}

        <button
          disabled={loading}
          className="rounded-md bg-gold-500 px-4 py-2 text-sm font-semibold text-surface-900 hover:bg-gold-400"
        >
          {loading ? 'Creating...' : 'Create Audit'}
        </button>

      </form>

    </div>
  );
}