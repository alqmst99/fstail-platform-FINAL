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
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

type ProposalFramework = 'AIDA' | 'PAS' | 'BAB';
const FRAMEWORKS: ProposalFramework[] = ['AIDA', 'PAS', 'BAB'];

export class ScanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  sourceUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  keyword?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  escrowOnly?: boolean = false;

  @ApiPropertyOptional()
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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSkills?: string[];
}

export class GenerateProposalDto {
  @ApiProperty({
    description: 'Objeto completo del proyecto obtenido del radar',
    example: {
      id: 40594129,
      title: "Fix Missing Google Business Listing",
      // ... resto del objeto
    }
  })
  @IsObject()
  // @ValidateNested()  ← Comentado / eliminado (causa el error)
  // @Type(() => Object) ← No es necesario aquí
  project!: Record<string, any>;

  @ApiPropertyOptional({ enum: FRAMEWORKS, default: 'AIDA' })
  @IsOptional()
  @IsIn(FRAMEWORKS)
  framework?: ProposalFramework = 'AIDA';

  @ApiPropertyOptional({ description: 'Contexto adicional de tu agencia' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  context?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  scanId?: string;
}

export class QueryScansDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  keyword?: string;
}

export class QueryProposalsDto extends PaginationDto {   // ← Aquí estaba el problema
  @ApiPropertyOptional({ enum: FRAMEWORKS })
  @IsOptional()
  @IsIn(FRAMEWORKS)
  framework?: ProposalFramework;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  scanId?: string;
}