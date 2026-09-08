import { IsString, IsOptional, IsBoolean, IsInt, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDailyTaskDto {
  @IsString()
  userTag!: string;

  @IsString()
  title!: string;

  @IsString()
  category!: string;

  @IsOptional() @IsInt() @Min(0)
  timeSpentMin?: number;

  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsInt() @Min(1) @Max(5)
  energyLevel?: number;

  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateDailyTaskDto {
  @IsOptional() @IsBoolean()
  completed?: boolean;

  @IsOptional() @IsInt() @Min(0)
  timeSpentMin?: number;

  @IsOptional() @IsInt() @Min(1) @Max(5)
  energyLevel?: number;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsString()
  title?: string;
}

export class QueryDailyTasksDto {
  @IsString()
  userTag!: string;

  @IsOptional() @IsDateString()
  date?: string;
}
