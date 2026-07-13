// src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
type Role = 'SUPER_ADMIN' | 'ADMIN' | 'ANALYST' | 'CLIENT';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route to specific roles.
 * Works with RbacGuard — hierarchy applies (ADMIN can access ANALYST routes).
 *
 * Usage:
 *   @Roles(Role.ADMIN)
 *   @Delete(':id')
 *   async delete(...) {}
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
