// src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '@fstail/types';

/**
 * Injects the authenticated user into a controller method parameter.
 * Relies on JwtStrategy.validate() having run first.
 *
 * Usage:
 *   async getMe(@CurrentUser() user: AuthUser) { ... }
 *   async doThing(@CurrentUser('id') userId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser;
    return field ? user?.[field] : user;
  },
);
