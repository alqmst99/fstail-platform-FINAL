// src/projects/dto/project.dto.ts
import {
  IsString,
  IsOptional,
  IsIn,
  IsUUID,
  MaxLength,
  MinLength,
  IsObject,
} from 'class-validator';
import { PartialType, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';
const PROJECT_STATUSES: ProjectStatus[] = ['ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED'];
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateProjectDto {
  @ApiProperty({ example: 'Website Redesign — Acme Corp' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ description: 'Link to an existing client' })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED'], default: 'ACTIVE' })
  @IsOptional()
  @IsIn(PROJECT_STATUSES)
  status?: ProjectStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

export class QueryProjectsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED'] })
  @IsOptional()
  @IsIn(PROJECT_STATUSES)
  status?: ProjectStatus;

  @ApiPropertyOptional({ description: 'Filter by client ID' })
  @IsOptional()
  @IsUUID()
  clientId?: string;
}
