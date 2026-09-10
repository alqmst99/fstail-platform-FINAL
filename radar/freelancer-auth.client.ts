/**
 * Freelancer.com Developer API client (OAuth 1.0a).
 * Docs: https://developers.freelancer.com/
 * App: https://www.freelancer.com/developers
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class FreelancerAuthClient {
  private readonly logger = new Logger(FreelancerAuthClient.name);
  private readonly baseUrl = 'https://www.freelancer.com/api';

  private consumerKey: string | null = null;
  private consumerSecret: string | null = null;
  private accessToken: string | null = null;
  private accessSecret: string | null = null;
  private bidderId: number | null = null;

  constructor(private readonly config: ConfigService) {
    this.consumerKey = this.config.get('FREELANCER_CONSUMER_KEY') || null;
    this.consumerSecret = this.config.get('FREELANCER_CONSUMER_SECRET') || null;
    this.accessToken = this.config.get('FREELANCER_ACCESS_TOKEN') || null;
    this.accessSecret = this.config.get('FREELANCER_ACCESS_TOKEN_SECRET') || null;
    const uid = this.config.get('FREELANCER_USER_ID');
    this.bidderId = uid ? Number(uid) : null;

    if (!this.isConfigured()) {
      this.logger.warn(
        'Freelancer OAuth incompleto — configure FREELANCER_* en .env para bids/mensajes',
      );
    }
  }

  isConfigured(): boolean {
    return !!(
      this.consumerKey &&
      this.consumerSecret &&
      this.accessToken &&
      this.accessSecret &&
      this.bidderId
    );
  }

  private ensureConfigured() {
    if (!this.isConfigured()) {
      throw new BadRequestException(
        'Freelancer Developer API no configurada. Ver docs/DEVELOPERS.md',
      );
    }
  }

  /** OAuth 1.0a HMAC-SHA1 Authorization header */
  private buildAuthHeader(method: string, url: string): string {
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const params: Record<string, string> = {
      oauth_consumer_key: this.consumerKey!,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: this.accessToken!,
      oauth_version: '1.0',
    };

    // Percent-encode and sort
    const paramString = Object.keys(params)
      .sort()
      .map(
        (k) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`,
      )
      .join('&');

    const baseUrl = url.split('?')[0];
    const baseString = [
      method.toUpperCase(),
      encodeURIComponent(baseUrl),
      encodeURIComponent(paramString),
    ].join('&');

    const signingKey = `${encodeURIComponent(this.consumerSecret!)}&${encodeURIComponent(this.accessSecret!)}`;
    const signature = crypto
      .createHmac('sha1', signingKey)
      .update(baseString)
      .digest('base64');

    params['oauth_signature'] = signature;

    const header =
      'OAuth ' +
      Object.keys(params)
        .sort()
        .map(
          (k) =>
            `${encodeURIComponent(k)}="${encodeURIComponent(params[k])}"`,
        )
        .join(', ');

    return header;
  }

  private async request<T = any>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    this.ensureConfigured();

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: this.buildAuthHeader(method, url),
      Accept: 'application/json',
      'User-Agent': 'FSTailPlatform/1.0',
    };

    let fetchBody: string | undefined;
    if (body && (method === 'POST' || method === 'PUT')) {
      headers['Content-Type'] = 'application/json';
      fetchBody = JSON.stringify(body);
    }

    const res = await fetch(url, {
      method,
      headers,
      body: fetchBody,
      signal: AbortSignal.timeout(20_000),
    });

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      this.logger.error(`Freelancer ${method} ${path} → ${res.status}`, data);
      throw new BadRequestException(
        data?.message || data?.error || data?.result?.message || `Freelancer API ${res.status}`,
      );
    }

    return data as T;
  }

  /**
   * POST /projects/0.1/bids/
   * Place a bid (requires verified freelancer account + OAuth).
   */
  async placeBid(payload: {
    projectId: number;
    amount: number;
    period: number;
    description: string;
    milestonePercentage?: number;
  }) {
    const body = {
      project_id: payload.projectId,
      bidder_id: this.bidderId,
      amount: payload.amount,
      period: payload.period,
      milestone_percentage: payload.milestonePercentage ?? 100,
      description: payload.description,
    };

    this.logger.log(`Bid → project ${payload.projectId} $${payload.amount} / ${payload.period}d`);
    return this.request('POST', '/projects/0.1/bids/', body);
  }

  /** GET project with selected bids / award info */
  async getProject(projectId: number | string) {
    return this.request(
      'GET',
      `/projects/0.1/projects/${projectId}/?full_description=true&job_details=true&user_details=true&selected_bids=true`,
    );
  }

  /** GET own bids */
  async getMyBids(limit = 50) {
    return this.request(
      'GET',
      `/projects/0.1/bids/?bidders[]=${this.bidderId}&limit=${limit}`,
    );
  }

  /** GET messages for a project */
  async getProjectMessages(projectId: number) {
    return this.request(
      'GET',
      `/messages/0.1/messages/?projects[]=${projectId}&limit=50`,
    );
  }

  /** POST message on project */
  async sendMessage(projectId: number, message: string) {
    return this.request('POST', '/messages/0.1/messages/', {
      project_id: projectId,
      message,
    });
  }
}
