/**
 * Freelancer.com Developer API — OAuth 2.0
 *
 * Auth header used by Freelancer API:
 *   Freelancer-OAuth-V1: <access_token>
 *
 * Flow:
 * 1. GET /oauth/authorize (browser)
 * 2. Callback with ?code=
 * 3. POST accounts.freelancer.com/oauth/token → access_token + refresh_token
 * 4. API calls with Freelancer-OAuth-V1 header
 *
 * App must be Approved for advanced scopes (fln:project_manage).
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FreelancerAuthClient {
  private readonly logger = new Logger(FreelancerAuthClient.name);
  private readonly baseUrl = 'https://www.freelancer.com/api';
  private readonly authorizeUrl = 'https://www.freelancer.com/oauth/authorize';
  private readonly tokenUrl = 'https://accounts.freelancer.com/oauth/token';

  private clientId: string | null = null;
  private clientSecret: string | null = null;
  private redirectUri: string | null = null;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private bidderId: number | null = null;

  constructor(private readonly config: ConfigService) {
    // ConfigService + fallback process.env (por si envFilePath no apunta al .env real)
    const env = (key: string) =>
      this.config.get<string>(key) || process.env[key] || null;

    this.clientId = env('FREELANCER_CLIENT_ID') || env('FREELANCER_CONSUMER_KEY');
    this.clientSecret =
      env('FREELANCER_CLIENT_SECRET') ||
      env('FREELANCER_CONSUMER_SECRET') ||
      env('FREELANCER_USER_SECRET');
    this.redirectUri = env('FREELANCER_REDIRECT_URI') || 'http://localhost:3000/callback';
    this.accessToken = env('FREELANCER_ACCESS_TOKEN');
    this.refreshToken = env('FREELANCER_REFRESH_TOKEN');
    const uid = env('FREELANCER_USER_ID');
    this.bidderId = uid ? Number(uid) : null;

    if (!this.accessToken) {
      this.logger.warn(
        'FREELANCER_ACCESS_TOKEN missing — sin token no se puede sync/listar bids',
      );
    } else {
      this.logger.log(
        `Freelancer OAuth listo (token ok). bidderId=${this.bidderId ?? 'null'} secret=${Boolean(this.clientSecret)}`,
      );
    }
    if (!this.clientId || !this.clientSecret) {
      this.logger.warn(
        'CLIENT_ID/SECRET incompletos — solo afecta refresh/exchange, no el sync con ACCESS_TOKEN',
      );
    }
  }

  /**
   * Para llamar a la API alcanza con ACCESS_TOKEN.
   * CLIENT_ID/SECRET solo hacen falta para exchange/refresh del OAuth.
   */
  isConfigured(): boolean {
    return Boolean(this.accessToken && String(this.accessToken).length > 8);
  }

  /** Token + client credentials (para refresh) */
  canRefreshToken(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.refreshToken);
  }

  hasBidderId(): boolean {
    return Boolean(this.bidderId && this.bidderId > 0);
  }

  /** Debug: qué falta en .env (sin filtrar secretos) */
  configStatus(): Record<string, boolean | string | number | null> {
    return {
      hasClientId: Boolean(this.clientId),
      hasClientSecret: Boolean(this.clientSecret),
      hasAccessToken: Boolean(this.accessToken),
      hasRefreshToken: Boolean(this.refreshToken),
      hasBidderId: this.hasBidderId(),
      bidderId: this.bidderId,
      isConfigured: this.isConfigured(),
    };
  }

  /** URL para abrir en el browser y autorizar la app */
  getAuthorizeUrl(scopes = 'basic fln:project_manage fln:user_information'): string {
    if (!this.clientId || !this.redirectUri) {
      throw new BadRequestException('FREELANCER_CLIENT_ID / REDIRECT_URI no configurados');
    }
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: scopes,
      prompt: 'select_account consent',
    });
    return `${this.authorizeUrl}?${params.toString()}`;
  }

  /** Intercambia authorization code por access + refresh token */
  async exchangeCode(code: string): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
    if (!this.clientId || !this.clientSecret) {
      throw new BadRequestException('Client credentials missing');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri || 'http://localhost:3000/callback',
    });

    const res = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
      signal: AbortSignal.timeout(20_000),
    });

    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!res.ok || !data.access_token) {
      this.logger.error('Token exchange failed', data);
      throw new BadRequestException(data.error_description || data.error || `Token error ${res.status}`);
    }

    this.accessToken = data.access_token;
    if (data.refresh_token) this.refreshToken = data.refresh_token;

    this.logger.log('OAuth tokens obtained — guardá FREELANCER_ACCESS_TOKEN y REFRESH_TOKEN en .env');
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    };
  }

  async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      throw new BadRequestException('No refresh token — re-autorizá la app');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const res = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
      signal: AbortSignal.timeout(20_000),
    });

    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!res.ok || !data.access_token) {
      throw new BadRequestException(data.error_description || data.error || 'Refresh failed');
    }

    this.accessToken = data.access_token;
    if (data.refresh_token) this.refreshToken = data.refresh_token;
    return this.accessToken!;
  }

  private ensureConfigured() {
    if (!this.isConfigured()) {
      throw new BadRequestException(
        `Freelancer OAuth incompleto: falta FREELANCER_ACCESS_TOKEN en .env. status=${JSON.stringify(this.configStatus())}`,
      );
    }
  }

  private async request<T = any>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    this.ensureConfigured();

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      // Header oficial Freelancer OAuth2
      'Freelancer-OAuth-V1': this.accessToken!,
      Accept: 'application/json',
      'User-Agent': 'FSTailPlatform/1.0',
    };

    let fetchBody: string | undefined;
    if (body && (method === 'POST' || method === 'PUT')) {
      headers['Content-Type'] = 'application/json';
      fetchBody = JSON.stringify(body);
    }

    let res = await fetch(url, {
      method,
      headers,
      body: fetchBody,
      signal: AbortSignal.timeout(20_000),
    });

    // retry once on 401 with refresh
    if (res.status === 401 && this.refreshToken) {
      await this.refreshAccessToken();
      headers['Freelancer-OAuth-V1'] = this.accessToken!;
      res = await fetch(url, {
        method,
        headers,
        body: fetchBody,
        signal: AbortSignal.timeout(20_000),
      });
    }

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

  async placeBid(payload: {
    projectId: number;
    amount: number;
    period: number;
    description: string;
    milestonePercentage?: number;
  }) {
    const body: Record<string, unknown> = {
      project_id: payload.projectId,
      amount: payload.amount,
      period: payload.period,
      milestone_percentage: payload.milestonePercentage ?? 100,
      description: payload.description,
    };
    if (this.bidderId) body.bidder_id = this.bidderId;

    this.logger.log(`Bid → project ${payload.projectId} $${payload.amount}`);
    return this.request('POST', '/projects/0.1/bids/', body);
  }

  async getProject(projectId: number | string) {
    return this.request(
      'GET',
      `/projects/0.1/projects/${projectId}/?full_description=true&job_details=true&user_details=true&selected_bids=true`,
    );
  }

  async getMyBids(opts: {
    limit?: number;
    offset?: number;
    fromTime?: number; // unix seconds
    toTime?: number;
  } = {}) {
    const limit = Math.min(opts.limit ?? 100, 100);
    const offset = opts.offset ?? 0;
    if (!this.bidderId) {
      throw new BadRequestException('FREELANCER_USER_ID requerido para listar tus bids');
    }
    let path =
      `/projects/0.1/bids/?bidders[]=${this.bidderId}` +
      `&limit=${limit}&offset=${offset}` +
      `&project_details=true` +
      `&user_details=true` +
      `&award_status_possibilities=true`;
    if (opts.fromTime) path += `&from_time=${opts.fromTime}`;
    if (opts.toTime) path += `&to_time=${opts.toTime}`;
    return this.request('GET', path);
  }

  /**
   * Histórico de TUS bids — maxTotal default 120 (rápido).
   * GET /projects/0.1/bids/?bidders[]={userId}
   */
  async fetchAllMyBids(maxTotal = 120): Promise<any[]> {
    const all: any[] = [];
    const limit = 60;
    const maxPages = Math.max(1, Math.ceil(maxTotal / limit));
    for (let page = 0; page < maxPages; page++) {
      const offset = page * limit;
      const data = await this.getMyBids({ limit, offset });
      const result = data?.result ?? data ?? {};
      const bidsObj = result.bids ?? result;
      const projectsMap = result.projects || {};
      const batch = Array.isArray(bidsObj)
        ? bidsObj
        : Object.values(bidsObj || {}).filter(
            (x: any) => x && typeof x === 'object' && (x.id != null || x.project_id != null),
          );
      // La API a menudo manda projects en un mapa aparte — mergear título/status/selected
      for (const bid of batch as any[]) {
        const pid = String(bid.project_id ?? bid.project?.id ?? '');
        const proj =
          (pid && (projectsMap[pid] || projectsMap[Number(pid)])) ||
          bid.project ||
          bid.project_details ||
          {};
        bid.project = {
          ...proj,
          title: proj.title || bid.project_title || bid.project?.title,
          status: proj.status || proj.frontend_project_status || bid.project?.status,
          seo_url: proj.seo_url || bid.seo_url,
          selected_bids: proj.selected_bids || bid.project?.selected_bids,
          bid_stats: proj.bid_stats || bid.project?.bid_stats,
        };
      }
      if (!batch.length) break;
      all.push(...(batch as any[]));
      if (all.length >= maxTotal) break;
      if ((batch as any[]).length < limit) break;
      await new Promise((r) => setTimeout(r, 180));
    }
    return all.slice(0, maxTotal);
  }

  /** Bids de un proyecto (para ver selected / winners) */
  async getProjectBids(projectId: number | string) {
    return this.request(
      'GET',
      `/projects/0.1/bids/?projects[]=${projectId}&limit=50&user_details=true`,
    );
  }

  async getSelf() {
    return this.request('GET', '/users/0.1/self/');
  }

  async getProjectMessages(projectId: number) {
    return this.request('GET', `/messages/0.1/messages/?projects[]=${projectId}&limit=50`);
  }

  async sendMessage(projectId: number, message: string) {
    return this.request('POST', '/messages/0.1/messages/', {
      project_id: projectId,
      message,
    });
  }
}
