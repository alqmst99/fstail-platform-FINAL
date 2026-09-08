// src/radar/freelancer.client.ts
// Thin wrapper around the Freelancer.com search API.
// Security fixes from Phase 1 applied:
//   R-02: URL allowlist validation before every request
//   All API responses validated before use
// Enhanced with strict quality filter (payment_verified, hire_rate, desc len, bid_count)

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import type { ScanDto } from './dto/radar.dto';
import type { FreelancerProject, FreelancerProjectExtended } from '@fstail/types';
import { evaluateProject } from './radarFilter';

const ALLOWED_FREELANCER_DOMAINS = [
  'https://www.freelancer.com',
  'https://freelancer.com',
];

const FREELANCER_SEARCH_BASE =
  'https://www.freelancer.com/api/projects/0.1/projects/active/';

@Injectable()
export class FreelancerClient {
  private readonly logger = new Logger(FreelancerClient.name);

  async fetchProjects(dto: ScanDto): Promise<{
    projects: FreelancerProjectExtended[];
    rawCount: number;
    validCount: number;
  }> {
    const url = this.buildUrl(dto);
    this.validateUrl(url);

    this.logger.log(`Radar scan: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FSTailPlatform/1.0',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(
        `Freelancer API returned ${response.status}: ${response.statusText}`,
      );
    }

    const body = (await response.json()) as Record<string, any>;
    const raw: unknown[] = body?.['result']?.['projects'] ?? [];
    const rawCount = raw.length;

    const projects = raw
      .map((p) => this.normalise(p))
      .filter((p): p is FreelancerProjectExtended => p !== null)
      .filter((p) => this.passesFilters(p, dto));

    return { projects, rawCount, validCount: projects.length };
  }

  private validateUrl(url: string): void {
    const allowed = ALLOWED_FREELANCER_DOMAINS.some((domain) =>
      url.startsWith(domain),
    );
    if (!allowed) {
      throw new BadRequestException(
        `[R-02] Rejected URL: must start with freelancer.com. Got: ${url}`,
      );
    }
  }

  private buildUrl(dto: ScanDto): string {
    if (dto.sourceUrl) {
      return dto.sourceUrl;
    }

    const params = new URLSearchParams({
      limit: String(dto.limit ?? 80),
      job_details: 'true',
      user_details: 'true',
      ...(dto.keyword && { query: dto.keyword }),
    });

    return `${FREELANCER_SEARCH_BASE}?${params.toString()}&types=hourly,fixed&projectLanguages=es,en&projectSort=fewestBids&projectSkills=9,17,33,38,69,77,120,219,305,323,335,481,500,598,758,759,788,997,999,1031,1042,1254,1365,1623,1832,2037,2164,2376,2839,3005`;
  }

  private normalise(raw: unknown): FreelancerProjectExtended | null {
    try {
      const p = raw as Record<string, any>;

      if (!p['id'] || !p['title']) return null;

      const owner = p['owner_details'] ?? p['owner'] ?? {};
      const budget = p['budget'] ?? {};
      const currency = p['currency'] ?? {};
      const bidStats = p['bid_stats'] ?? {};
      const reputation = owner['employer_reputation']?.['entire'] ?? owner['reputation'] ?? {};
      const status = owner['status'] ?? {};

      const paymentVerified =
        Boolean(status['payment_verified']) ||
        Boolean(owner['payment_verified']) ||
        Boolean(owner['escrowcom_interaction_status'] === 'verified');

      const hireRate = Number(reputation['hire_rate'] ?? reputation['hireRate'] ?? 0);
      const reviewsCount = Number(reputation['reviews'] ?? reputation['review_count'] ?? 0);
      const avgBid = Number(bidStats['avg_bid'] ?? bidStats['bid_avg'] ?? 0);
      const bidCount = Number(bidStats['bid_count'] ?? 0);

      const location = owner['location'] ?? {};
      const country =
        location['country']?.['name'] ??
        location['country_name'] ??
        owner['country'] ??
        undefined;

      const attachments = Array.isArray(p['attachments'])
        ? p['attachments'].map((a: any) => ({
            id: Number(a['id'] ?? 0),
            filename: String(a['filename'] ?? a['name'] ?? 'file'),
            url: a['url'] ? String(a['url']) : undefined,
          }))
        : [];

      return {
        id: Number(p['id']),
        title: String(p['title'] ?? '').trim(),
        seoUrl: String(p['seo_url'] ?? ''),
        description: String(p['description'] ?? ''),
        budget: {
          minimum: Number(budget['minimum'] ?? 0),
          maximum: Number(budget['maximum'] ?? 0),
          currencyCode: String(currency['code'] ?? 'USD'),
        },
        currency: {
          sign: String(currency['sign'] ?? '$'),
          code: String(currency['code'] ?? 'USD'),
        },
        bidCount,
        skills: Array.isArray(p['jobs'])
          ? p['jobs'].map((j: any) => String(j['name'] ?? '')).filter(Boolean)
          : [],
        owner: {
          id: Number(owner['id'] ?? 0),
          username: String(owner['username'] ?? ''),
          escrowComSupported: Boolean(owner['escrowcom_interaction_status'] === 'verified'),
          hasLinkedEscrowAccount: Boolean(owner['has_linked_escrow_account']),
        },
        scannedAt: new Date().toISOString(),
        // Extended fields for strict filter
        paymentVerified,
        hireRate,
        reviewsCount,
        avgBid,
        clientCountry: country,
        clientSpent: Number(owner['total_amount_spent'] ?? owner['spent'] ?? 0) || undefined,
        attachments,
      };
    } catch (err) {
      this.logger.warn(`Failed to normalise project: ${err}`);
      return null;
    }
  }

  /**
   * Filtros legacy (budget, skills, escrow) + filtro estricto de calidad del prompt.
   */
  private passesFilters(project: FreelancerProjectExtended, dto: ScanDto): boolean {
    // Legacy filters
    if (dto.escrowOnly && !project.owner.escrowComSupported) return false;
    if (dto.minBudget && project.budget.maximum < dto.minBudget) return false;
    if (dto.maxBudget && project.budget.minimum > dto.maxBudget) return false;

    if (dto.requiredSkills?.length) {
      const projectSkills = project.skills.map((s) => s.toLowerCase());
      const hasAll = dto.requiredSkills.every((skill) =>
        projectSkills.some((ps) => ps.includes(skill.toLowerCase())),
      );
      if (!hasAll) return false;
    }

    // Strict quality filter from the development prompt
    const evaluation = evaluateProject(project);
    if (!evaluation.qualified) {
      this.logger.debug(
        `Project ${project.id} rejected: ${evaluation.reasons.join('; ')}`,
      );
      return false;
    }

    return true;
  }

  /**
   * Evaluar un proyecto individual (útil para el frontend Quick Bid).
   */
  evaluate(project: FreelancerProjectExtended) {
    return evaluateProject(project);
  }
}
