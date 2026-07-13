// packages/types/src/index.ts
// Shared TypeScript types used across web, api, and desktop
// These mirror the Prisma schema enums and key shapes

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'ANALYST' | 'CLIENT';
export type Plan = 'FREE' | 'PRO' | 'ENTERPRISE';
export type ClientStatus = 'LEAD' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type AuditStatus = 'DRAFT' | 'IN_PROGRESS' | 'DONE' | 'ARCHIVED';
export type ProposalFramework = 'AIDA' | 'PAS' | 'BAB';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

// ── Auth ─────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;       // user ID
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  workspaceId: string | null;
}

// ── API Responses ─────────────────────────────────────────────────────

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ── Audit ─────────────────────────────────────────────────────────────

export interface AuditSection {
  key: string;
  label: string;
  score: number | null;   // 0–10 per section
  observations: string;
  evidenceUrls: string[];
}

// ── Radar ─────────────────────────────────────────────────────────────

export interface FreelancerProject {
  id: number;
  title: string;
  seoUrl: string;
  description: string;
  budget: {
    minimum: number;
    maximum: number;
    currencyCode: string;
  };
  currency: {
    sign: string;
    code: string;
  };
  bidCount: number;
  skills: string[];
  owner: {
    id: number;
    username: string;
    escrowComSupported: boolean;
    hasLinkedEscrowAccount: boolean;
  };
  scannedAt: string; // ISO date
}

// ── Token pair ─────────────────────────────────────────────────────
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
