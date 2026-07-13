// src/workspaces/dto/workspace.dto.ts
import {
  IsString,
  IsOptional,
  IsIn,
  IsUUID,
  MinLength,
  MaxLength,
  Matches,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
type Plan = 'FREE' | 'PRO' | 'ENTERPRISE';
const PLANS: Plan[] = ['FREE', 'PRO', 'ENTERPRISE'];

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ example: 'FSTail Solutions' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({
    example: 'fstail-solutions',
    description: 'URL-safe slug — lowercase letters, numbers, hyphens only',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must be lowercase letters, numbers, and hyphens only',
  })
  slug?: string;

  @ApiPropertyOptional({ description: 'Arbitrary workspace-level settings JSON' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

export class TransferOwnershipDto {
  @ApiProperty({ description: 'UUID of the new workspace owner (must be a member)' })
  @IsUUID()
  newOwnerId!: string;
}

export class UpdatePlanDto {
  @ApiProperty({ enum: ['FREE', 'PRO', 'ENTERPRISE'] })
  @IsIn(PLANS)
  plan!: Plan;
}
