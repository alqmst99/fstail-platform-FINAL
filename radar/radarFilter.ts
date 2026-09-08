// apps/api/src/radar/radarFilter.ts
// Filtro de calidad estricto + extracción de adjuntos para el Radar Freelancer

import type { FreelancerProjectExtended, RadarFilterResult } from '@fstail/types';

/**
 * Extrae texto plano de adjuntos (placeholder para pipeline async real).
 * En producción: usar pdf-parse, mammoth, tesseract vía cola BullMQ.
 */
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
    return `[Adjunto procesable: ${att.filename} — extracción async pendiente]`;
  }

  if (/\.(png|jpe?g|webp|gif)$/i.test(name)) {
    return `[Imagen: ${att.filename} — OCR pendiente]`;
  }

  return `[Adjunto no soportado: ${att.filename}]`;
}

/**
 * Reglas de filtrado estricto del prompt:
 * 1. owner.status.payment_verified == true
 * 2. Si reviews > 0 → hire_rate >= 0.60
 * 3. description.length >= 120
 * 4. bid_count <= 15
 */
export function evaluateProject(project: FreelancerProjectExtended): RadarFilterResult {
  const reasons: string[] = [];
  let qualified = true;

  // 1. Payment verified obligatorio
  if (!project.paymentVerified) {
    qualified = false;
    reasons.push('Cliente sin payment_verified');
  }

  // 2. Hire rate mínimo si tiene reviews
  const reviews = project.reviewsCount ?? 0;
  const hireRate = project.hireRate ?? 0;
  if (reviews > 0 && hireRate < 0.6) {
    qualified = false;
    reasons.push(`Hire rate bajo (${(hireRate * 100).toFixed(0)}% < 60%)`);
  }

  // 3. Descripción mínima
  const descLen = (project.description || '').trim().length;
  if (descLen < 120) {
    qualified = false;
    reasons.push(`Descripción corta (${descLen} chars < 120)`);
  }

  // 4. No saturado
  const bidCount = project.bidCount ?? 0;
  if (bidCount > 15) {
    qualified = false;
    reasons.push(`Proyecto saturado (${bidCount} bids > 15)`);
  }

  // Precios
  const avgBidPrice = project.avgBid ?? 0;
  const recommendedPrice =
    avgBidPrice > 0 ? Math.round(avgBidPrice * 0.92) : Math.round((project.budget?.minimum ?? 0) * 0.9);

  // Adjuntos
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
    clientHireRate: hireRate || undefined,
    clientSpent: project.clientSpent,
  };
}
