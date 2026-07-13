// src/common/guards/rbac.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
type Role = 'SUPER_ADMIN' | 'ADMIN' | 'ANALYST' | 'CLIENT';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * RBAC hierarchy — each role includes all permissions below it.
 *
 *   SUPER_ADMIN > ADMIN > ANALYST > CLIENT
 */
const ROLE_HIERARCHY: Record<Role, number> = {
  'SUPER_ADMIN': 4,
  'ADMIN': 3,
  'ANALYST': 2,
  'CLIENT': 1,
};

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator — route is accessible to any authenticated user
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();

    if (!user?.role) {
      throw new ForbiddenException('No role assigned');
    }

    const userLevel = ROLE_HIERARCHY[user.role as Role] ?? 0;
    const requiredLevel = Math.min(
      ...requiredRoles.map((r) => ROLE_HIERARCHY[r] ?? 99),
    );

    if (userLevel < requiredLevel) {
      throw new ForbiddenException(
        `Required role: ${requiredRoles.join(' or ')}. Your role: ${user.role}`,
      );
    }

    return true;
  }
}
