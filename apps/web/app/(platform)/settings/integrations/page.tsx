'use client';
// apps/web/app/(platform)/settings/integrations/page.tsx
// Groq API key management.
// - In the browser: key is sent to the NestJS API (server-side, never client-exposed)
// - In Electron: key is stored via safeStorage IPC (OS keychain, Phase 9)

import { useState, useEffect, FormEvent } from 'react';
import { userPreferencesApi } from '../../../../lib/api';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Check if we're running inside Electron
const isElectron = typeof window !== 'undefined' && !!(window as any).electron;

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

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <GroqSection />
      <FreelancerSection />
      <RadarAutomationSection />
    </div>
  );
}

function RadarAutomationSection() {
  const [technologies, setTechnologies] = useState('WordPress, React, Node.js, TypeScript');
  const [autoScan, setAutoScan] = useState(false);
  const [interval, setInterval] = useState(15);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    userPreferencesApi.get().then(({ preferences }) => {
      const radar = (preferences.radar ?? {}) as Record<string, unknown>;
      if (typeof radar.requiredSkills === 'string' && radar.requiredSkills) setTechnologies(radar.requiredSkills);
      if (typeof radar.autoScan === 'boolean') setAutoScan(radar.autoScan);
      if (typeof radar.scanIntervalMinutes === 'number') setInterval(radar.scanIntervalMinutes);
    }).catch(() => {});
  }, []);

  async function save() {
    await userPreferencesApi.update({
      radar: {
        requiredSkills: technologies,
        autoScan,
        scanIntervalMinutes: interval,
      },
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  return (
    <SettingsCard title="Radar automático">
      <div className="space-y-4">
        <p className="text-sm text-surface-400">Estas preferencias se guardan en tu usuario y se reutilizan en cada auto-scan.</p>
        <label className="block text-sm text-surface-300">
          Tecnologías básicas
          <input value={technologies} onChange={(e) => setTechnologies(e.target.value)} className="mt-1 w-full rounded-md border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-surface-50" />
          <span className="mt-1 block text-xs text-surface-500">Separadas por coma. Se usan como skills requeridas.</span>
        </label>
        <label className="flex items-center justify-between rounded-md border border-surface-700 bg-surface-900 p-3 text-sm text-surface-300">
          Activar auto-scan
          <input type="checkbox" checked={autoScan} onChange={(e) => setAutoScan(e.target.checked)} className="h-4 w-4 accent-gold-500" />
        </label>
        {autoScan && (
          <label className="flex items-center justify-between text-sm text-surface-300">
            Intervalo
            <select value={interval} onChange={(e) => setInterval(Number(e.target.value))} className="rounded-md border border-surface-600 bg-surface-900 px-2 py-1.5">
              {[5, 10, 15, 30, 60].map((value) => <option key={value} value={value}>{value} minutos</option>)}
            </select>
          </label>
        )}
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void save()} className={BTN_PRIMARY}>Guardar preferencias</button>
          {saved && <span className="text-sm text-emerald-400">Guardado ✓</span>}
        </div>
      </div>
    </SettingsCard>
  );
}

// ── Groq AI section ───────────────────────────────────────────────────

function GroqSection() {
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    // Check if key is already stored
    if (isElectron) {
      (window as any).electron.apiKey.get().then((key: string | null) => {
        setHasKey(!!key);
      });
    } else {
      // Server-side: check if GROQ_API_KEY env var is configured
      apiFetch<{ configured: boolean }>('/settings/groq/status')
        .then((r) => setHasKey(r.configured))
        .catch(() => setHasKey(false));
    }
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!apiKey.trim()) { setError('API key is required'); return; }
    if (!apiKey.startsWith('gsk_')) {
      setError('Groq API keys start with gsk_');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      if (isElectron) {
        // Electron path — store in OS keychain via safeStorage (R-01 fix)
        await (window as any).electron.apiKey.save(apiKey);
      } else {
        // Web path — send to server (never stored client-side)
        await apiFetch('/settings/groq/key', {
          method: 'POST',
          body: JSON.stringify({ apiKey }),
        });
      }
      setHasKey(true);
      setApiKey('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save key');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Remove the Groq API key? AI proposal generation will stop working.')) return;
    try {
      if (isElectron) {
        await (window as any).electron.apiKey.delete();
      } else {
        await apiFetch('/settings/groq/key', { method: 'DELETE' });
      }
      setHasKey(false);
    } catch (err: any) {
      setError(err.message ?? 'Failed to remove key');
    }
  }

  return (
    <SettingsCard title="Groq AI">
      <div className="space-y-4">
        <p className="text-sm text-surface-400">
          Required for AI proposal generation in the Radar module.
          Get your key at{' '}
          <a
            href="https://console.groq.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold-400 hover:text-gold-300"
          >
            console.groq.com
          </a>
          .
        </p>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${hasKey ? 'bg-emerald-400' : 'bg-surface-600'}`} />
          <span className="text-sm text-surface-300">
            {hasKey === null ? 'Checking…' : hasKey ? 'API key configured' : 'No API key set'}
          </span>
          {hasKey && (
            <button
              onClick={handleDelete}
              className="ml-auto text-xs text-red-500 hover:text-red-400 transition"
            >
              Remove
            </button>
          )}
        </div>

        {/* Security note for Electron */}
        {isElectron && (
          <p className="rounded-md bg-surface-900 px-3 py-2 text-xs text-surface-500">
            🔒 In the desktop app, your API key is encrypted using the OS keychain (Windows
            Credential Manager / macOS Keychain). It is never stored in plain text.
          </p>
        )}

        {/* Key input form */}
        <form onSubmit={handleSave} className="space-y-3">
          <div className="flex gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? 'Enter new key to replace…' : 'gsk_…'}
              className="flex-1 rounded-md border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-surface-50 placeholder-surface-500 outline-none focus:border-gold-500 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="rounded-md border border-surface-600 px-3 py-2 text-xs text-surface-400 hover:bg-surface-800 transition"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>

          {error   && <p className="text-sm text-red-400">{error}</p>}
          {success && <p className="text-sm text-emerald-400">API key saved ✓</p>}

          <button type="submit" disabled={saving || !apiKey} className={BTN_PRIMARY}>
            {saving ? 'Saving…' : hasKey ? 'Update key' : 'Save key'}
          </button>
        </form>
      </div>
    </SettingsCard>
  );
}

// ── Freelancer section ────────────────────────────────────────────────

function FreelancerSection() {
  return (
    <SettingsCard title="Freelancer.com">
      <div className="space-y-3">
        <p className="text-sm text-surface-400">
          The Radar scanner fetches projects from Freelancer.com's public search API.
          No API key required — scans use the public endpoint.
        </p>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-sm text-surface-300">Ready — no configuration needed</span>
        </div>
        <div className="rounded-md bg-surface-900 px-3 py-2 text-xs text-surface-500 space-y-1">
          <p>Base URL: <span className="font-mono">freelancer.com/api/projects/0.1/projects/active/</span></p>
          <p>Rate limit: 10 scans/minute per workspace</p>
          <p>Filter: Only English-language projects, max 200/scan</p>
        </div>
      </div>
    </SettingsCard>
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

const BTN_PRIMARY = 'rounded-md bg-gold-500 px-4 py-2 text-sm font-semibold text-surface-900 hover:bg-gold-400 disabled:opacity-60 transition';
