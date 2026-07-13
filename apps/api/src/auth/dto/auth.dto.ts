// src/auth/dto/auth.dto.ts
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsUUID,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Request DTOs ─────────────────────────────────────────────────────

export class LoginDto {
  @ApiProperty({ example: 'admin@fstailsolutions.com.ar' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'ChangeMe123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'ana@fstailsolutions.com.ar' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'Ana Clara' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName!: string;

  @ApiPropertyOptional({ example: 'fstail-solutions' })
  @IsOptional()
  @IsString()
  workspaceSlug?: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'admin@fstailsolutions.com.ar' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  token!: string;

  @ApiProperty({ example: 'NewStrongPass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  token!: string;
}

// ── Response DTOs ─────────────────────────────────────────────────────

export class AuthUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  role!: string;

  @ApiPropertyOptional()
  workspaceId?: string | null;
}

export class LoginResponseDto {
  @ApiProperty()
  message!: string;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}
