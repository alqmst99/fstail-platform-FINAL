// src/users/users.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  InviteUserDto,
  UpdateUserRoleDto,
  UpdateProfileDto,
  QueryUsersDto,
} from './dto/user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { RbacGuard } from '../common/guards/rbac.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
type Role = 'SUPER_ADMIN' | 'ADMIN' | 'ANALYST' | 'CLIENT';
import type { AuthUser } from '@fstail/types';

@ApiTags('users')
@ApiCookieAuth('accessToken')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /api/users/me
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile with workspace info' })
  getMe(@CurrentUser('id') userId: string) {
    return this.usersService.getMe(userId);
  }

  // PATCH /api/users/me
  @Patch('me')
  @ApiOperation({ summary: 'Update own display name or password' })
  updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateMe(userId, dto);
  }

  // GET /api/users  (workspace members — ADMIN+)
  @Get()
  @Roles('ADMIN')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'List workspace members (ADMIN+)' })
  findAll(
    @Query() query: QueryUsersDto,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.usersService.findAll(workspaceId, query);
  }

  // POST /api/users/invite  (ADMIN+)
  @Post('invite')
  @Roles('ADMIN')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'Invite a new user to the workspace (ADMIN+)' })
  invite(
    @Body() dto: InviteUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.invite(dto, user.workspaceId!, user.id);
  }

  // PATCH /api/users/:id/role  (ADMIN+)
  @Patch(':id/role')
  @Roles('ADMIN')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'Change a workspace member role (ADMIN+)' })
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.updateRole(id, dto, user.workspaceId!, user.id);
  }

  // DELETE /api/users/:id  (ADMIN+ — deactivates user)
  @Delete(':id')
  @Roles('ADMIN')
  @UseGuards(WorkspaceGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a workspace member (ADMIN+)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.remove(id, user.workspaceId!, user.id);
  }
}
