import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { subject } from '@casl/ability';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AbilityFactory } from '../authorization/ability.factory';
import { PrismaService } from '../database/prisma.service';
import type { CreateTaskDto } from './dto/create-task.dto';
import type { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import type { UpdateTaskDto } from './dto/update-task.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilityFactory: AbilityFactory,
    private readonly notificationsService: NotificationsService,
  ) {}

  async list(user: AuthenticatedUser, query: ListTasksQueryDto) {
    const ability = await this.abilityFactory.createForUser(user);
    const assignedTaskSubject = subject('Task', { userId: user.id }) as unknown as 'Task';
    const createdTaskSubject = subject('Task', { createdById: user.id, userId: '' }) as unknown as 'Task';
    if (!ability.can('read', assignedTaskSubject) && !ability.can('read', createdTaskSubject)) {
      throw new ForbiddenException();
    }

    const visibilityFilter = user.role === 'ADMIN'
      ? null
      : user.role === 'USER' && !user.customRoleId
        ? { userId: user.id }
        : { OR: [{ createdById: user.id }, { userId: user.id }] };
    const filters = [
      ...(visibilityFilter ? [visibilityFilter] : []),
      ...(query.status ? [{ status: query.status }] : []),
      ...(query.search ? [{
        OR: [
          { title: { contains: query.search } },
          { description: { contains: query.search } },
        ],
      }] : []),
    ];
    const where = filters.length > 0 ? { AND: filters } : {};
    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.task.count({ where }),
    ]);
    return { items, page: query.page, limit: query.limit, total, pageCount: Math.ceil(total / query.limit) };
  }

  async create(user: AuthenticatedUser, dto: CreateTaskDto) {
    const ability = await this.abilityFactory.createForUser(user);
    if (!ability.can('create', 'Task')) throw new ForbiddenException();
    const canAssignTask = ability.can(
      'manage',
      subject('Task', { createdById: user.id, userId: dto.userId ?? user.id }) as unknown as 'Task',
    );
    if (dto.userId && !canAssignTask) {
      throw new ForbiddenException('Only managers and administrators can assign a task to another user.');
    }

    const ownerId = dto.userId ?? user.id;
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId }, select: { id: true, role: true } });
    if (!owner) throw new NotFoundException('Task owner was not found.');
    if (dto.userId && user.role !== 'ADMIN' && owner.role === 'ADMIN') {
      throw new ForbiddenException('Tasks cannot be assigned to an administrator.');
    }
    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          status: dto.status,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
          userId: ownerId,
          createdById: user.id,
        },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      });
      await tx.taskActivity.create({
        data: { taskId: created.id, actorId: user.id, action: 'CREATED', summary: 'Created this task' },
      });
      return created;
    });
    if (ownerId !== user.id) await this.notifyAssignment(ownerId, task.title);
    return task;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task was not found.');

    const ability = await this.abilityFactory.createForUser(user);
    const taskSubject = subject('Task', task) as unknown as 'Task';
    if (!ability.can('update', taskSubject)) {
      // Nest transforms plain request bodies into DTO instances. With ES2022
      // class fields, optional DTO properties can be own properties whose
      // values are undefined, so count only fields actually supplied by the
      // request before deciding whether this is a completion-only update.
      const providedFields = Object.entries(dto)
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key);
      const onlyCompleting =
        providedFields.length === 1 &&
        providedFields[0] === 'status' &&
        dto.status === 'COMPLETED';
      if (!onlyCompleting || !ability.can('complete', taskSubject)) throw new ForbiddenException();
      const completed = await this.prisma.$transaction(async (tx) => {
        const result = await tx.task.update({ where: { id }, data: { status: 'COMPLETED' } });
        if (task.status !== 'COMPLETED') {
          await tx.taskActivity.create({
            data: { taskId: id, actorId: user.id, action: 'COMPLETED', summary: 'Marked this task complete' },
          });
        }
        return result;
      });
      if (task.status !== 'COMPLETED' && task.createdById && task.createdById !== user.id) {
        await this.notifyCompletion(task.createdById, task.title);
      }
      return completed;
    }

    if (dto.userId && !ability.can('manage', 'Task')) throw new ForbiddenException();
    if (dto.userId && dto.userId !== task.userId) {
      const owner = await this.prisma.user.findUnique({ where: { id: dto.userId }, select: { id: true, role: true } });
      if (!owner) throw new NotFoundException('Task owner was not found.');
      if (user.role !== 'ADMIN' && owner.role === 'ADMIN') {
        throw new ForbiddenException('Tasks cannot be assigned to an administrator.');
      }
    }
    const changedFields: string[] = [];
    if (dto.title !== undefined && dto.title.trim() !== task.title) changedFields.push('title');
    if (dto.description !== undefined && (dto.description?.trim() || null) !== task.description) changedFields.push('description');
    if (dto.status !== undefined && dto.status !== task.status) changedFields.push('status');
    if (dto.dueAt !== undefined) {
      const nextDueAt = dto.dueAt ? new Date(dto.dueAt).getTime() : null;
      const currentDueAt = task.dueAt?.getTime() ?? null;
      if (nextDueAt !== currentDueAt) changedFields.push('due date');
    }
    if (dto.userId !== undefined && dto.userId !== task.userId) changedFields.push('assignee');

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.task.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.dueAt !== undefined ? { dueAt: dto.dueAt ? new Date(dto.dueAt) : null } : {}),
          ...(dto.userId !== undefined ? { userId: dto.userId } : {}),
        },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      });
      if (changedFields.length > 0) {
        const action =
          dto.status === 'COMPLETED' && task.status !== 'COMPLETED' ? 'COMPLETED'
            : dto.userId !== undefined && dto.userId !== task.userId ? 'REASSIGNED'
              : dto.status !== undefined && dto.status !== task.status ? 'STATUS_CHANGED'
                : 'UPDATED';
        const summary = action === 'COMPLETED'
          ? 'Marked this task complete'
          : action === 'REASSIGNED'
            ? 'Reassigned this task'
            : action === 'STATUS_CHANGED'
              ? `Changed status from ${task.status} to ${dto.status}`
              : `Updated ${changedFields.join(', ')}`;
        await tx.taskActivity.create({ data: { taskId: id, actorId: user.id, action, summary } });
      }
      return result;
    });
    if (dto.userId && dto.userId !== task.userId) await this.notifyAssignment(dto.userId, updated.title);
    if (dto.status === 'COMPLETED' && task.status !== 'COMPLETED' && task.createdById && task.createdById !== user.id) {
      await this.notifyCompletion(task.createdById, updated.title);
    }
    return updated;
  }

  async activity(user: AuthenticatedUser, id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task was not found.');

    const ability = await this.abilityFactory.createForUser(user);
    if (!ability.can('read', subject('Task', task) as unknown as 'Task')) {
      throw new ForbiddenException();
    }

    return this.prisma.taskActivity.findMany({
      where: { taskId: id },
      select: {
        id: true,
        action: true,
        summary: true,
        createdAt: true,
        actor: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
  }

  async remove(user: AuthenticatedUser, id: string): Promise<{ status: 'ok' }> {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task was not found.');
    const ability = await this.abilityFactory.createForUser(user);
    const taskSubject = subject('Task', task) as unknown as 'Task';
    if (!ability.can('delete', taskSubject)) throw new ForbiddenException();
    await this.prisma.task.delete({ where: { id } });
    return { status: 'ok' };
  }

  private async notifyAssignment(userId: string, title: string): Promise<void> {
    try {
      await this.notificationsService.create({
        userId,
        title: 'A task was assigned to you',
        message: title,
      });
    } catch {
      console.error('[notification] Could not save task assignment notification.');
    }
  }

  private async notifyCompletion(userId: string, title: string): Promise<void> {
    try {
      await this.notificationsService.create({
        userId,
        title: 'A task was completed',
        message: title,
      });
    } catch {
      console.error('[notification] Could not save task completion notification.');
    }
  }
}
