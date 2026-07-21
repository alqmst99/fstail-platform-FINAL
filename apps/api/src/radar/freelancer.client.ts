// src/radar/freelancer.client.ts
// Thin wrapper around the Freelancer.com search API.
// Security fixes from Phase 1 applied:
//   R-02: URL allowlist validation before every request
//   All API responses validated before use

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import type { ScanDto } from './dto/radar.dto';
import type { FreelancerProject } from '@fstail/types';

// R-02 Fix — allowlist of permitted base URLs for outbound requests
const ALLOWED_FREELANCER_DOMAINS = [
  'https://www.freelancer.com',
  'https://freelancer.com',
];

const FREELANCER_SEARCH_BASE =
  'https://www.freelancer.com/api/projects/0.1/projects/active/';

@Injectable()
export class FreelancerClient {
  private readonly logger = new Logger(FreelancerClient.name);

  /**
   * Fetch active projects from Freelancer.com search API.
   * Applies budget, escrow, and skill filters server-side before returning.
   */
  async fetchProjects(dto: ScanDto): Promise<{
    projects: FreelancerProject[];
    rawCount: number;
    validCount: number;
  }> {
    const url = this.buildUrl(dto);
    this.validateUrl(url); // R-02

    this.logger.log(`Radar scan: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FSTailPlatform/1.0',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000), // 15s timeout
    });

    if (!response.ok) {
      throw new Error(
        `Freelancer API returned ${response.status}: ${response.statusText}`,
      );
    }

    const body = await response.json() as Record<string, any>;
    const raw: unknown[] = body?.['result']?.['projects'] ?? [];
    const rawCount = raw.length;

    const projects = raw
      .map((p) => this.normalise(p))
      .filter((p): p is FreelancerProject => p !== null)
      .filter((p) => this.passesFilters(p, dto));

    return { projects, rawCount, validCount: projects.length };
  }

  // ── Private ───────────────────────────────────────────────────────

  /**
   * R-02: Reject any URL that doesn't point to freelancer.com.
   * Prevents SSRF — a crafted URL could reach internal services.
   */
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
      // User provided a full URL — validate it, then use directly
      return dto.sourceUrl;
    }

    // Build from keyword
    const params = new URLSearchParams({
      limit: String(dto.limit ?? 80),
      job_details: 'true',
      user_details: 'true',
      ...(dto.keyword && { q: dto.keyword }),
    });

    return `${FREELANCER_SEARCH_BASE}?${params.toString()}&types=hourly,fixed&projectLanguages=es,en&projectSort=fewestBids&projectSkills=9,17,33,38,69,77,120,219,305,323,335,481,500,598,758,759,788,997,999,1031,1042,1254,1365,1623,1832,2037,2164,2376,2839,3005`
  }

  private normalise(raw: unknown): FreelancerProject | null {
    try {
      const p = raw as Record<string, any>;

      if (!p['id'] || !p['title']) return null;

      const owner = p['owner_details'] ?? p['owner'] ?? {};
      const budget = p['budget'] ?? {};
      const currency = p['currency'] ?? {};

      return {
        id: Number(p['id']),
        title: String(p['title'] ?? '').trim(),
        seoUrl: String(p['seo_url'] ?? ''),
        description: String(p['description'] ?? '').slice(0, 1000),
        budget: {
          minimum: Number(budget['minimum'] ?? 0),
          maximum: Number(budget['maximum'] ?? 0),
          currencyCode: String(currency['code'] ?? 'USD'),
        },
        currency: {
          sign: String(currency['sign'] ?? '$'),
          code: String(currency['code'] ?? 'USD'),
        },
        bidCount: Number(p['bid_stats']?.['bid_count'] ?? 0),
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
      };
    } catch (err) {
      this.logger.warn(`Failed to normalise project: ${err}`);
      return null;
    }
  }

  private passesFilters(project: FreelancerProject, dto: ScanDto): boolean {
    // R-06 fix: "escrow supported" is a specific technical flag, not "verified client"
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

    return true;
  }
}
