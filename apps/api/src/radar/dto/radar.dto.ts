// src/radar/dto/radar.dto.ts
import {
  IsString,
  IsOptional,
  IsUrl,
  IsInt,
  IsUUID,
  IsArray,
  Min,
  Max,
  MaxLength,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
type ProposalFramework = 'AIDA' | 'PAS' | 'BAB';
const FRAMEWORKS: ProposalFramework[] = ['AIDA', 'PAS', 'BAB'];
type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
const DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];
import { PaginationDto } from '../../common/dto/pagination.dto';

// ── Scan ─────────────────────────────────────────────────────────────

export class ScanDto {
  @ApiPropertyOptional({
    description: 'Full Freelancer search URL (alternative to keyword)',
    example: 'https://www.freelancer.com/jobs/web-development/?languages=en',
  })
  @IsOptional()
  @IsUrl()
  sourceUrl?: string;

  @ApiPropertyOptional({
    description: 'Keyword — used to build URL if sourceUrl not provided',
    example: 'react typescript',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  keyword?: string;

  @ApiPropertyOptional({ default: 50, description: 'Max projects to fetch per scan' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: false, description: 'Only return escrow-supported projects' })
  @IsOptional()
  @IsBoolean()
  escrowOnly?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minBudget?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxBudget?: number;

  @ApiPropertyOptional({ type: [String], description: 'Required skill tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSkills?: string[];
}

// ── Generate proposal ─────────────────────────────────────────────────

export class GenerateProposalDto {
  @ApiProperty({ description: 'Raw project data from a radar scan result' })
  project!: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ['AIDA', 'PAS', 'BAB'], default: 'AIDA' })
  @IsOptional()
  @IsIn(FRAMEWORKS)
  framework?: ProposalFramework;

  @ApiPropertyOptional({
    description: 'Custom context to include in the prompt (your skills, tone, etc.)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  context?: string;

  @ApiPropertyOptional({ description: 'Scan ID to link proposal to' })
  @IsOptional()
  @IsUUID()
  scanId?: string;
}

// ── Query scans ───────────────────────────────────────────────────────

export class QueryScansDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  keyword?: string;
}

// ── Query proposals ───────────────────────────────────────────────────

export class QueryProposalsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['AIDA', 'PAS', 'BAB'] })
  @IsOptional()
  @IsIn(FRAMEWORKS)
  framework?: ProposalFramework;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  scanId?: string;
}
