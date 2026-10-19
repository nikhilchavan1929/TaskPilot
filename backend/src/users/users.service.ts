import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { UpdateUserRoleDto } from './dto/update-user-role.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { customRole: { select: { name: true } } },
    });
    if (!user) throw new NotFoundException('User was not found.');
    return {
      id: user.id,
      email: user.email,
      role: user.customRole?.name ?? user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      birthDate: user.birthDate?.toISOString().slice(0, 10) ?? null,
      avatarUrl: user.avatarUrl,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName?.trim() || null } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName?.trim() || null } : {}),
        ...(dto.birthDate !== undefined ? { birthDate: dto.birthDate ? new Date(`${dto.birthDate.slice(0, 10)}T12:00:00.000Z`) : null } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl?.trim() || null } : {}),
      },
      include: { customRole: { select: { name: true } } },
    });
    return {
      id: user.id,
      email: user.email,
      role: user.customRole?.name ?? user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      birthDate: user.birthDate?.toISOString().slice(0, 10) ?? null,
      avatarUrl: user.avatarUrl,
    };
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        customRole: { select: { id: true, name: true } },
      },
      orderBy: { email: 'asc' },
    });
    return users.map((user) => ({ ...user, roleName: user.customRole?.name ?? user.role }));
  }

  async updateRole(actor: AuthenticatedUser, targetId: string, dto: UpdateUserRoleDto) {
    if (actor.id === targetId && dto.role !== 'ADMIN') {
      throw new BadRequestException('An administrator cannot change their own role.');
    }
    const current = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!current) throw new NotFoundException('User was not found.');
    if (current.role === 'ADMIN' && dto.role !== 'ADMIN') {
      const administratorCount = await this.prisma.user.count({ where: { role: 'ADMIN' } });
      if (administratorCount <= 1) throw new BadRequestException('The last administrator cannot be demoted.');
    }
    if (dto.customRoleId) {
      const customRole = await this.prisma.role.findUnique({ where: { id: dto.customRoleId }, select: { id: true, isSystem: true } });
      if (!customRole) throw new NotFoundException('Custom role was not found.');
      if (customRole.isSystem) throw new BadRequestException('Choose a system role using the role field.');
      if (dto.role !== 'USER') throw new BadRequestException('Choose either a built-in role or a custom role.');
    }
    return this.prisma.user.update({
      where: { id: targetId },
      data: { role: dto.customRoleId ? 'USER' : dto.role, customRoleId: dto.customRoleId ?? null },
      select: { id: true, email: true, role: true, customRoleId: true },
    });
  }

  async remove(actor: AuthenticatedUser, targetId: string): Promise<{ status: 'ok' }> {
    if (actor.id === targetId) throw new BadRequestException('An administrator cannot delete their own account.');
    const target = await this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true, role: true } });
    if (!target) throw new NotFoundException('User was not found.');
    if (target.role === 'ADMIN') {
      const administratorCount = await this.prisma.user.count({ where: { role: 'ADMIN' } });
      if (administratorCount <= 1) throw new BadRequestException('The last administrator cannot be deleted.');
    }
    await this.prisma.user.delete({ where: { id: targetId } });
    return { status: 'ok' };
  }
}
