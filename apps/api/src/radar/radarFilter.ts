// Quality filter with SELECTABLE options (not always-on)

import type { FreelancerProjectExtended, RadarFilterResult } from '@fstail/types';

export interface QualityFilterOptions {
  requirePaymentVerified?: boolean;
  requireHireRate60?: boolean;
  requireMinDescription?: boolean;
  requireMaxBids?: boolean;
  minDescriptionLength?: number;
  maxBidCount?: number;
}

export function extractTextFromAttachment(att: {
  filename: string;
  url?: string;
  buffer?: Buffer;
}): string {
  const name = (att.filename || '').toLowerCase();
  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv')) {
    if (att.buffer) return att.buffer.toString('utf-8').slice(0, 8000);
    return `[Adjunto texto: ${att.filename}]`;
  }
  if (name.endsWith('.pdf') || name.endsWith('.docx') || name.endsWith('.doc')) {
    return `[Adjunto procesable: ${att.filename}]`;
  }
  if (/\.(png|jpe?g|webp|gif)$/i.test(name)) {
    return `[Imagen: ${att.filename}]`;
  }
  return `[Adjunto: ${att.filename}]`;
}

/**
 * Evalúa un proyecto. Solo aplica las reglas que el usuario activó en options.
 * Si options está vacío / todo false → siempre qualified (pasa por calidad).
 */
export function evaluateProject(
  project: FreelancerProjectExtended,
  options: QualityFilterOptions = {},
): RadarFilterResult {
  const reasons: string[] = [];
  let qualified = true;

  const minDesc = options.minDescriptionLength ?? 120;
  const maxBids = options.maxBidCount ?? 15;

  if (options.requirePaymentVerified) {
    if (!project.paymentVerified) {
      qualified = false;
      reasons.push('Cliente sin payment_verified');
    }
  }

  if (options.requireHireRate60) {
    const reviews = project.reviewsCount ?? 0;
    const hireRate = project.hireRate ?? 0;
    if (reviews > 0 && hireRate < 0.6) {
      qualified = false;
      reasons.push(`Hire rate bajo (${(hireRate * 100).toFixed(0)}% < 60%)`);
    }
  }

  if (options.requireMinDescription) {
    const descLen = (project.description || '').trim().length;
    if (descLen < minDesc) {
      qualified = false;
      reasons.push(`Descripción corta (${descLen} < ${minDesc})`);
    }
  }

  if (options.requireMaxBids) {
    const bidCount = project.bidCount ?? 0;
    if (bidCount > maxBids) {
      qualified = false;
      reasons.push(`Saturado (${bidCount} bids > ${maxBids})`);
    }
  }

  const avgBidPrice = project.avgBid ?? 0;
  const recommendedPrice =
    avgBidPrice > 0
      ? Math.round(avgBidPrice * 0.92)
      : Math.round((project.budget?.minimum ?? 0) * 0.9);

  let attachmentsText = '';
  if (project.attachments?.length) {
    attachmentsText = project.attachments
      .map((a) => extractTextFromAttachment(a))
      .filter(Boolean)
      .join('\n\n---\n\n');
  } else if (project.attachmentsText) {
    attachmentsText = project.attachmentsText;
  }

  return {
    qualified,
    reasons,
    avgBidPrice,
    recommendedPrice,
    attachmentsText,
    clientCountry: project.clientCountry,
    clientHireRate: project.hireRate,
    clientSpent: project.clientSpent,
  };
}
