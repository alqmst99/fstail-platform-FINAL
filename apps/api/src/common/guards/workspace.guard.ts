// src/common/guards/workspace.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
type Role = 'SUPER_ADMIN' | 'ADMIN' | 'ANALYST' | 'CLIENT';

/**
 * Ensures a user can only access resources belonging to their workspace.
 * SUPER_ADMIN is exempt — they can access all workspaces.
 *
 * Apply at controller level for all CRM/Audit/Radar/Report routes.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, WorkspaceGuard)
 *   @Controller('clients')
 */
@Injectable()
export class WorkspaceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) throw new ForbiddenException('Not authenticated');

    // SUPER_ADMIN bypasses workspace isolation
    if (user.role === 'SUPER_ADMIN') return true;

    // All other roles must belong to a workspace
    if (!user.workspaceId) {
      throw new ForbiddenException('User has no workspace assigned');
    }

    // Attach workspaceId to req so services can use it without
    // re-reading from the DB. Services must always filter by
    // req.workspaceId — never trust a workspaceId from the request body.
    req.workspaceId = user.workspaceId;

    return true;
  }
}
