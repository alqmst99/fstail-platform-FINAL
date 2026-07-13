// src/reports/dto/report.dto.ts
import {
  IsString,
  IsOptional,
  IsArray,
  IsUUID,
  IsObject,
  IsInt,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { PartialType, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

// ── Report content block types ────────────────────────────────────────
// Content is stored as a JSON array of typed blocks — extensible for future.

export type ReportBlockType =
  | 'heading'
  | 'text'
  | 'audit_summary'    // embeds a single audit's score and sections
  | 'audit_comparison' // side-by-side comparison of multiple audits
  | 'score_chart'      // score visualisation
  | 'recommendations'  // list of recommendations
  | 'divider';

export interface ReportBlock {
  type: ReportBlockType;
  id:   string;   // client-generated UUID for drag-reorder
  data: Record<string, unknown>;
}

// ── Create ────────────────────────────────────────────────────────────

export class CreateReportDto {
  @ApiProperty({ example: 'Q1 2025 Web Audit — Acme Corp' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ description: 'Initial content blocks' })
  @IsOptional()
  @IsArray()
  blocks?: ReportBlock[];

  @ApiPropertyOptional({ description: 'Audit IDs to pre-populate the report' })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  auditIds?: string[];
}

// ── Update content ────────────────────────────────────────────────────

export class UpdateReportDto extends PartialType(CreateReportDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;
}

// ── Publish (generate portal token) ──────────────────────────────────

export class PublishReportDto {
  @ApiProperty({
    description: 'Portal link TTL in days',
    default: 30,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  ttlDays?: number;
}

// ── Query ─────────────────────────────────────────────────────────────

export class QueryReportsDto extends PaginationDto {}
