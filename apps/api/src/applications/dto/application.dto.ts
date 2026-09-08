import { IsString, IsNumber, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum BidStatusDto {
  POSTULADO = 'POSTULADO',
  EN_CONVERSACION = 'EN_CONVERSACION',
  ADJUDICADO_A_MIME = 'ADJUDICADO_A_MIME',
  ADJUDICADO_A_OTRO = 'ADJUDICADO_A_OTRO',
  CANCELADO = 'CANCELADO',
  NO_ADJUDICADO = 'NO_ADJUDICADO',
}

export class CreateApplicationDto {
  @IsString()
  freelancerProjId!: string;

  @IsString()
  title!: string;

  @IsString()
  rawDescription!: string;

  @IsOptional() @IsString()
  translatedDesc?: string;

  @IsOptional() @IsString()
  clientCountry?: string;

  @IsOptional() @IsNumber()
  clientHireRate?: number;

  @IsOptional() @IsNumber()
  clientSpent?: number;

  @IsNumber()
  avgBidPrice!: number;

  @IsNumber()
  recommendedPrice!: number;

  @IsNumber()
  submittedPrice!: number;

  @IsInt()
  submittedDays!: number;

  @IsString()
  proposalText!: string;

  @IsOptional() @IsString()
  attachmentsText?: string;

  @IsOptional() @IsString()
  assignedToUserTag?: string;
}

export class UpdateApplicationStatusDto {
  @IsEnum(BidStatusDto)
  status!: BidStatusDto;

  @IsOptional() @IsNumber()
  winnerBidPrice?: number;

  @IsOptional() @IsNumber()
  winnerRating?: number;

  @IsOptional() @IsInt()
  winnerReviewsCount?: number;
}

export class CreateMessageDto {
  @IsString()
  text!: string;

  @IsString()
  sender!: 'me' | 'client';

  @IsOptional() @IsString()
  externalId?: string;
}

export class QueryApplicationsDto {
  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsString()
  assignedTo?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize?: number = 20;
}
