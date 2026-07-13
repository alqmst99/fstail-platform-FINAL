'use client';
// apps/web/components/reports/report-detail-client.tsx

import { useState } from 'react';
import { reportsApi, type ReportDetail } from '../../lib/reports-api';
import { BlockRenderer } from './block-renderer';

export function ReportDetailClient({ report: initial }: { report: ReportDetail }) {
  const [report, setReport] = useState<ReportDetail>(initial);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const blocks = report.content?.blocks ?? [];
  const isActive = report.portalActive;
  const portalUrl = report.portalToken
    ? `${window?.location?.origin ?? ''}/portal/${report.portalToken}`
    : null;

  async function handlePublish() {
    setPublishing(true);
    setError('');
    try {
      const result = await reportsApi.publish(report.id, 30);
      // Refresh report data
      const updated = await reportsApi.get(report.id);
      setReport(updated);
    } catch (err: any) {
      setError(err.message ?? 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnpublish() {
    if (!confirm('Revoke the portal link? The client will lose access.')) return;
    setPublishing(true);
    setError('');
    try {
      await reportsApi.unpublish(report.id);
      const updated = await reportsApi.get(report.id);
      setReport(updated);
    } catch (err: any) {
      setError(err.message ?? 'Failed to unpublish');
    } finally {
      setPublishing(false);
    }
  }

  function handleCopyLink() {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="flex h-full">

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6 print:p-0">
        <div className="mx-auto max-w-3xl">
          {/* Print header */}
          <div className="mb-6 hidden print:block">
            <h1 className="text-2xl font-bold text-gray-900">{report.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {report.workspace?.name} · {new Date(report.updatedAt).toLocaleDateString()}
            </p>
          </div>

          <BlockRenderer blocks={blocks} isPortal={false} />
        </div>
      </div>

      {/* Right sidebar — actions */}
      <aside className="w-56 flex-shrink-0 overflow-auto border-l border-surface-700 bg-surface-950 p-5 print:hidden">
        <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-surface-500">
          Actions
        </h2>

        {error && (
          <p className="mb-3 rounded bg-red-950 px-2 py-1.5 text-xs text-red-400">{error}</p>
        )}

        {/* Portal status */}
        <div className="mb-4 rounded-md border border-surface-700 bg-surface-900 p-3">
          <p className="text-xs font-medium text-surface-300 mb-1">Client portal</p>
          {isActive ? (
            <>
              <span className="inline-block mb-2 rounded bg-emerald-950 px-1.5 py-0.5 text-xs text-emerald-400">
                Active
              </span>
              {report.portalTokenExpiresAt && (
                <p className="text-xs text-surface-500 mb-2">
                  Expires{' '}
                  {new Date(report.portalTokenExpiresAt).toLocaleDateString()}
                </p>
              )}
            </>
          ) : (
            <span className="inline-block mb-2 rounded bg-surface-800 px-1.5 py-0.5 text-xs text-surface-500">
              Not published
            </span>
          )}

          {isActive ? (
            <div className="space-y-1.5">
              <button
                onClick={handleCopyLink}
                className="w-full rounded bg-surface-700 px-2 py-1.5 text-xs text-surface-200 hover:bg-surface-600 transition"
              >
                {copied ? '✓ Copied!' : '📋 Copy link'}
              </button>
              <button
                onClick={handleUnpublish}
                disabled={publishing}
                className="w-full rounded border border-red-900 px-2 py-1.5 text-xs text-red-400 hover:bg-red-950 disabled:opacity-60 transition"
              >
                Revoke link
              </button>
            </div>
          ) : (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="w-full rounded-md bg-gold-500 py-1.5 text-xs font-semibold text-surface-900 hover:bg-gold-400 disabled:opacity-60 transition"
            >
              {publishing ? 'Publishing…' : '🔗 Publish (30 days)'}
            </button>
          )}
        </div>

        {/* Portal preview link */}
        {portalUrl && (
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block mb-4 text-xs text-surface-500 hover:text-surface-300 truncate"
          >
            Preview portal →
          </a>
        )}

        {/* PDF export */}
        <button
          onClick={handlePrint}
          className="w-full rounded-md border border-surface-600 py-1.5 text-xs text-surface-300 hover:bg-surface-800 transition"
        >
          🖨️ Export PDF
        </button>

        <p className="mt-1.5 text-xs text-surface-600 leading-snug">
          Use browser Print → Save as PDF for best results.
        </p>

        {/* Meta */}
        <div className="mt-6 border-t border-surface-700 pt-4 space-y-1">
          <p className="text-xs text-surface-600">
            By {report.createdBy?.displayName}
          </p>
          <p className="text-xs text-surface-600">
            {new Date(report.updatedAt).toLocaleDateString()}
          </p>
          <p className="text-xs text-surface-600">
            {blocks.length} block{blocks.length !== 1 ? 's' : ''}
          </p>
        </div>
      </aside>
    </div>
  );
}
