// src/users/dto/user.dto.ts
import {
  IsString,
  IsEmail,
  IsOptional,
  IsIn,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
type Role = 'SUPER_ADMIN' | 'ADMIN' | 'ANALYST' | 'CLIENT';
const ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'ANALYST', 'CLIENT'];
import { PaginationDto } from '../../common/dto/pagination.dto';

export class InviteUserDto {
  @ApiProperty({ example: 'ana@fstailsolutions.com.ar' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Ana Clara' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName!: string;

  @ApiProperty({ enum: ['SUPER_ADMIN', 'ADMIN', 'ANALYST', 'CLIENT'], default: 'ANALYST' })
  @IsIn(ROLES)
  role!: Role;
}

export class UpdateUserRoleDto {
  @ApiProperty({ enum: ['SUPER_ADMIN', 'ADMIN', 'ANALYST', 'CLIENT'] })
  @IsIn(ROLES)
  role!: Role;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Nahuel García' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName?: string;

  @ApiPropertyOptional({ example: 'NewPassword123!' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  currentPassword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword?: string;
}

export class QueryUsersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['SUPER_ADMIN', 'ADMIN', 'ANALYST', 'CLIENT'] })
  @IsOptional()
  @IsIn(ROLES)
  role?: Role;
}
