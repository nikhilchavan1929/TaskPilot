import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CheckAbility } from '../authorization/check-ability.decorator';
import { PoliciesGuard } from '../authorization/policies.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Get()
  @CheckAbility((ability) => ability.can('read', 'User'))
  listUsers() { return this.usersService.listUsers(); }

  @Patch(':id/role')
  @CheckAbility((ability) => ability.can('manage', 'User'))
  updateRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) { return this.usersService.updateRole(actor, id, dto); }

  @Delete(':id')
  @CheckAbility((ability) => ability.can('manage', 'User'))
  remove(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.remove(actor, id);
  }
}
