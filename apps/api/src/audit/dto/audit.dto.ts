// src/audit/dto/audit.dto.ts
import {
  IsString,
  IsOptional,
  IsIn,
  IsUUID,
  IsInt,
  IsArray,
  ValidateNested,
  Min,
  Max,
  MaxLength,
  MinLength,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
type AuditStatus = 'DRAFT' | 'IN_PROGRESS' | 'DONE' | 'ARCHIVED';
const AUDIT_STATUSES: AuditStatus[] = ['DRAFT', 'IN_PROGRESS', 'DONE', 'ARCHIVED'];
import { PaginationDto } from '../../common/dto/pagination.dto';

// ── Section input ─────────────────────────────────────────────────────

export class AuditSectionDto {
  @ApiProperty({ example: 'performance' })
  @IsString()
  key!: string;

  @ApiProperty({ example: 7, minimum: 0, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  score?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observations?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  evidenceUrls?: string[];
}

// ── General info ─────────────────────────────────────────────────────

export class AuditGeneralInfoDto {
  @ApiPropertyOptional({ example: 'https://acme.com' })
  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @ApiPropertyOptional({ example: 'E-commerce, B2C' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  industry?: string;

  @ApiPropertyOptional({ example: 'Improve conversion rate and Core Web Vitals' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  objective?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  context?: string;
}

// ── Create audit ─────────────────────────────────────────────────────

export class CreateAuditDto {
  @ApiProperty({ example: 'Web Audit — Acme Corp Q1 2025' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Use null for default template' })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional({ type: AuditGeneralInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AuditGeneralInfoDto)
  generalInfo?: AuditGeneralInfoDto;
}

// ── Update sections ───────────────────────────────────────────────────

export class UpdateAuditSectionsDto {
  @ApiProperty({ type: [AuditSectionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AuditSectionDto)
  sections!: AuditSectionDto[];

  @ApiProperty({
    description: 'Optimistic lock version — must match current DB version',
    example: 1,
  })
  @IsInt()
  @Min(1)
  version!: number;
}

// ── Update metadata ───────────────────────────────────────────────────

export class UpdateAuditDto extends PartialType(CreateAuditDto) {
  @ApiPropertyOptional({ enum: ['DRAFT', 'IN_PROGRESS', 'DONE', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(AUDIT_STATUSES)
  status?: AuditStatus;
}

// ── Query ─────────────────────────────────────────────────────────────

export class QueryAuditsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['DRAFT', 'IN_PROGRESS', 'DONE', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(AUDIT_STATUSES)
  status?: AuditStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
