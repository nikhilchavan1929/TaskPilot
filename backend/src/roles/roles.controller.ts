import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CheckAbility } from '../authorization/check-ability.decorator';
import { PoliciesGuard } from '../authorization/policies.guard';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, PoliciesGuard)
@CheckAbility((ability) => ability.can('manage', 'Role'))
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  list() { return this.rolesService.list(); }

  @Post()
  create(@Body() dto: CreateRoleDto) { return this.rolesService.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) { return this.rolesService.update(id, dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.rolesService.remove(id); }
}
