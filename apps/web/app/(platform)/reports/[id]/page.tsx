// apps/web/app/(platform)/reports/[id]/page.tsx
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ReportDetailClient } from '../../../../components/reports/report-detail-client';
import type { Metadata } from 'next';

async function fetchReport(id: string) {
  const token = cookies().get('accessToken')?.value;
  const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${API}/api/reports/${id}`, {
    headers: { Cookie: `accessToken=${token}` },
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to load report');
  return res.json();
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const report = await fetchReport(params.id);
  return { title: report?.title ?? 'Report' };
}

export default async function ReportDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const report = await fetchReport(params.id);
  if (!report) notFound();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-surface-700 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/reports"
            className="text-sm text-surface-500 hover:text-surface-300"
          >
            ← Reports
          </Link>
          <span className="text-surface-600">/</span>
          <h1 className="text-lg font-semibold text-surface-50">{report.title}</h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <ReportDetailClient report={report} />
      </div>
    </div>
  );
}
