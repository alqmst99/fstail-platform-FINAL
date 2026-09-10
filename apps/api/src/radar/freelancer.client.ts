// src/radar/freelancer.client.ts
// Thin wrapper around the Freelancer.com search API.
// Security fixes from Phase 1 applied:
//   R-02: URL allowlist validation before every request
//   All API responses validated before use
// Enhanced with strict quality filter (payment_verified, hire_rate, desc len, bid_count)

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import type { ScanDto } from './dto/radar.dto';
import type { FreelancerProject, FreelancerProjectExtended } from '@fstail/types';
import { evaluateProject, shouldRejectFreelancerUser } from './radarFilter';

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
      full_description: 'true',
      job_details: 'true',
      user_details: 'true',
      owner_info: 'true',
      attachment_details: 'true',
      location_details: 'true',
      upgrade_details: 'true',
      client_engagement_details: 'true',
      qualification_details: 'true',
      ...(dto.keyword && { query: dto.keyword }),
    });

    return `${FREELANCER_SEARCH_BASE}?${params.toString()}&types=hourly,fixed&projectLanguages=es,en&projectSort=fewestBids`;
  }

  private normalise(raw: unknown): FreelancerProjectExtended | null {
    try {
      const p = raw as Record<string, any>;

      if (!p['id'] || !p['title']) return null;

      const owner = p['owner_info'] ?? p['owner_details'] ?? p['owner'] ?? {};
      const budget = p['budget'] ?? {};
      const currency = p['currency'] ?? {};
      const bidStats = p['bid_stats'] ?? {};
      const reputation =
        owner['employer_reputation']?.['entire'] ??
        owner['reputation']?.['entire_history'] ??
        owner['reputation'] ??
        {};
      const status = owner['status'] ?? {};

      const readBoolean = (...values: unknown[]): boolean | undefined => {
        for (const value of values) {
          if (value === true || value === 1 || value === '1' || value === 'true') return true;
          if (value === false || value === 0 || value === '0' || value === 'false') return false;
        }
        return undefined;
      };

      const flPaymentVerified = readBoolean(
        p['flPaymentVerified'],
        p['fl_payment_verified'],
        p['payment_verified'],
        owner['flPaymentVerified'],
        owner['fl_payment_verified'],
        owner['payment_verified'],
        status['flPaymentVerified'],
        status['fl_payment_verified'],
        status['payment_verified'],
      );
      const paymentSignals = [
        flPaymentVerified,
        readBoolean(owner['payment_verified'], status['payment_verified']),
        readBoolean(owner['escrowcom_interaction_status'] === 'verified' ? true : undefined),
      ];
      const paymentVerified = paymentSignals.some((value) =>
        value === true,
      )
        ? true
        : paymentSignals.some((value) =>
            value === false,
          )
          ? false
          : undefined;

      const hireRate = Number(reputation['hire_rate'] ?? reputation['hireRate'] ?? 0);
      const reviewsCount = Number(reputation['reviews'] ?? reputation['review_count'] ?? 0);
      const avgBid = Number(bidStats['avg_bid'] ?? bidStats['bid_avg'] ?? 0);
      const bidCount = Number(bidStats['bid_count'] ?? 0);
      const budgetMax = Number(budget['maximum'] ?? budget['minimum'] ?? 0);
      const clientScore = Number(p['score'] ?? owner['score'] ?? 0) || undefined;
      const clientReputation = Number(
        reputation['overall'] ?? reputation['positive'] ?? 0,
      ) || undefined;
      const clientStatus = owner['status'] ?? {};
      const employerStats = owner['employer_stats'] ?? {};
      const isEscrowProject = readBoolean(p['is_escrow_project']);
      const escrowSupportedCurrency = readBoolean(currency['is_escrowcom_supported']);
      const minimumBid = Number(p['minimum_bid'] ?? 0) || undefined;
      const maximumBid = Number(p['maximum_bid'] ?? 0) || undefined;
      const defaultBid = Number(p['default_bid']?.['amount'] ?? 0) || undefined;
      const clientProjectsPosted = Number.isFinite(Number(employerStats['projects_posted']))
        ? Number(employerStats['projects_posted'])
        : undefined;
      const clientProjectsCompleted = Number.isFinite(Number(employerStats['projects_completed']))
        ? Number(employerStats['projects_completed'])
        : undefined;
      const clientFreelancersContacted = Number.isFinite(Number(employerStats['freelancers_contacted']))
        ? Number(employerStats['freelancers_contacted'])
        : undefined;

      const location = owner['location'] ?? owner['country'] ?? {};
      const country =
        location['country']?.['name'] ??
        location['country_name'] ??
        location['name'] ??
        owner['country'] ??
        undefined;

      const attachments = Array.isArray(p['attachments'])
        ? p['attachments'].map((a: any) => ({
            id: Number(a['id'] ?? 0),
            filename: String(a['filename'] ?? a['name'] ?? 'file'),
            url: a['url'] ? String(a['url']) : undefined,
          }))
        : [];

      const submittedRaw =
        p['time_submitted'] ?? p['submitdate'] ?? p['time_updated'] ?? null;
      let timeSubmitted: string | undefined;
      if (typeof submittedRaw === 'number') {
        // Freelancer often returns unix seconds
        timeSubmitted = new Date(
          submittedRaw > 1e12 ? submittedRaw : submittedRaw * 1000,
        ).toISOString();
      } else if (typeof submittedRaw === 'string' && submittedRaw) {
        timeSubmitted = new Date(submittedRaw).toISOString();
      }

      const ageHours = submittedRaw
        ? Math.max(0, (Date.now() - new Date(timeSubmitted ?? 0).getTime()) / 3_600_000)
        : 999;
      const tier = paymentVerified === true && budgetMax >= 200 && bidCount <= 8 &&
        (reviewsCount === 0 || hireRate >= 0.6) && ageHours <= 6
        ? 'premium'
        : paymentVerified === true && bidCount <= 12 && ageHours <= 6 && budgetMax >= 50
          ? 'good'
          : ageHours > 48 ? 'old' : ageHours <= 6 ? 'normal' : 'old';

      return {
        id: Number(p['id']),
        title: String(p['title'] ?? '').trim(),
        seoUrl: String(p['seo_url'] ?? ''),
        description: String(p['description'] ?? p['preview_description'] ?? ''),
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
        tier,
        flPaymentVerified,
        paymentVerificationSource: flPaymentVerified !== undefined
          ? 'freelancer.flPaymentVerified'
          : paymentVerified !== undefined ? 'freelancer.payment_verified' : undefined,
        clientScore,
        clientReputation,
        clientDepositMade: readBoolean(clientStatus['deposit_made']),
        clientIdentityVerified: readBoolean(clientStatus['identity_verified']),
        clientEmailVerified: readBoolean(clientStatus['email_verified']),
        clientProfileComplete: readBoolean(clientStatus['profile_complete']),
        clientProjectsPosted,
        clientProjectsCompleted,
        clientFreelancersContacted,
        isEscrowProject,
        escrowSupportedCurrency,
        minimumBid,
        maximumBid,
        defaultBid,
        currencyExchangeRate: Number(currency['exchange_rate'] ?? 0) || undefined,
        skills: Array.isArray(p['jobs'])
          ? p['jobs'].map((j: any) => String(j['name'] ?? '')).filter(Boolean)
          : [],
        owner: {
          id: Number(owner['id'] ?? 0),
          username: String(owner['username'] ?? ''),
          escrowComSupported: Boolean(
            owner['escrowcom_interaction_status'] === 'verified' ||
            owner['escrowcom_account_linked'] === true,
          ),
          hasLinkedEscrowAccount: Boolean(
            owner['has_linked_escrow_account'] || owner['escrowcom_account_linked'],
          ),
          paymentVerified,
        },
        scannedAt: new Date().toISOString(),
        timeSubmitted,
        // Extended fields for strict filter + UI tiers
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
    const owner = {
      status: {
        payment_verified: project.paymentVerified,
      },
      employer_stats: {
        projects_completed: project.clientProjectsCompleted,
        freelancers_contacted: project.clientFreelancersContacted,
      },
    };
    if (shouldRejectFreelancerUser(owner)) return false;

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

    // Quality filters only if user enabled them in the scan form
    const evaluation = evaluateProject(project, {
      requirePaymentVerified: dto.requirePaymentVerified,
      requireHireRate60: dto.requireHireRate60,
      requireMinDescription: dto.requireMinDescription,
      requireMaxBids: dto.requireMaxBids,
      minDescriptionLength: dto.minDescriptionLength,
      maxBidCount: dto.maxBidCount,
    });
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
