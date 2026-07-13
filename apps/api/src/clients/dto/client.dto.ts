// src/clients/dto/client.dto.ts
import {
  IsString,
  IsEmail,
  IsOptional,
  IsIn,
  IsUrl,
  MaxLength,
  MinLength,
  IsObject,
} from 'class-validator';
import { PartialType, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

type ClientStatus = 'LEAD' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
const CLIENT_STATUSES: ClientStatus[] = ['LEAD', 'ACTIVE', 'INACTIVE', 'ARCHIVED'];
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateClientDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'contact@acme.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+54 11 1234-5678' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ example: 'https://acme.com' })
  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  website?: string;

  @ApiPropertyOptional({ enum: ['LEAD', 'ACTIVE', 'INACTIVE', 'ARCHIVED'], default: 'LEAD' })
  @IsOptional()
  @IsIn(CLIENT_STATUSES)
  status?: ClientStatus;

  @ApiPropertyOptional({ example: 'Met at DevConf 2024' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Arbitrary key-value metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateClientDto extends PartialType(CreateClientDto) {}

export class QueryClientsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['LEAD', 'ACTIVE', 'INACTIVE', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(CLIENT_STATUSES)
  status?: ClientStatus;
}
