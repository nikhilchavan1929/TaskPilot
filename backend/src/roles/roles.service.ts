import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { CreateRoleDto } from './dto/create-role.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const roles = await this.prisma.role.findMany({
      include: { permissions: true, _count: { select: { users: true } } },
      orderBy: { name: 'asc' },
    });
    return roles.map(({ _count, ...role }) => ({
      ...role,
      assignedUsers: role.isSystem ? null : _count.users,
    }));
  }

  async create(dto: CreateRoleDto) {
    const name = dto.name.trim().toUpperCase();
    const existing = await this.prisma.role.findUnique({ where: { name }, select: { isSystem: true } });
    if (existing?.isSystem) throw new BadRequestException('That name is reserved for a system role.');
    this.assertNoGlobalSubject(dto.permissions);
    try {
      return await this.prisma.role.create({
        data: {
          name,
          description: dto.description?.trim() || null,
          permissions: {
            create: dto.permissions.map((permission) => ({
              action: permission.action,
              subject: permission.subject,
              conditions: null,
            })),
          },
        },
        include: { permissions: true },
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) throw new ConflictException('A role with that name already exists.');
      throw error;
    }
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role was not found.');
    if (role.isSystem) throw new BadRequestException('System roles cannot be edited.');
    if (dto.permissions) this.assertNoGlobalSubject(dto.permissions);
    const name = dto.name?.trim().toUpperCase();
    if (name) {
      const namedRole = await this.prisma.role.findUnique({ where: { name }, select: { isSystem: true } });
      if (namedRole?.isSystem) throw new BadRequestException('That name is reserved for a system role.');
    }
    try {
      return await this.prisma.$transaction(async (transaction) => {
        if (dto.permissions) await transaction.rolePermission.deleteMany({ where: { roleId: id } });
        return transaction.role.update({
          where: { id },
          data: {
            ...(name ? { name } : {}),
            ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
            ...(dto.permissions ? {
              permissions: {
                create: dto.permissions.map((permission) => ({
                  action: permission.action,
                  subject: permission.subject,
                  conditions: null,
                })),
              },
            } : {}),
          },
          include: { permissions: true },
        });
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) throw new ConflictException('A role with that name already exists.');
      throw error;
    }
  }

  async remove(id: string): Promise<{ status: 'ok' }> {
    const role = await this.prisma.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
    if (!role) throw new NotFoundException('Role was not found.');
    if (role.isSystem) throw new BadRequestException('System roles cannot be deleted.');
    if (role._count.users > 0) throw new BadRequestException('Reassign users before deleting this role.');
    await this.prisma.role.delete({ where: { id } });
    return { status: 'ok' };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }

  private assertNoGlobalSubject(permissions: Array<{ subject: string }>): void {
    if (permissions.some((permission) => permission.subject === 'all')) {
      throw new BadRequestException('The all subject is reserved for administrators. Choose explicit resources instead.');
    }
  }
}
