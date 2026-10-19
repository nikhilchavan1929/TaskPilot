import { Injectable } from '@nestjs/common';
import { createMongoAbility, type MongoAbility } from '@casl/ability';
import type { UserRole } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

export type AbilityAction = 'manage' | 'create' | 'read' | 'update' | 'delete' | 'complete';
export type AbilitySubject = 'Task' | 'User' | 'Role' | 'all';
export type AppAbility = MongoAbility<[AbilityAction, AbilitySubject]>;
export type AppRule = {
  action: AbilityAction | AbilityAction[];
  subject: AbilitySubject | AbilitySubject[];
  conditions?: Record<string, unknown>;
  inverted?: boolean;
};

export interface AbilityUser {
  id: string;
  role: UserRole;
  customRoleId?: string | null;
}

function taskVisibilityRules(action: AbilityAction, userId: string): AppRule[] {
  return [
    { action, subject: 'Task', conditions: { createdById: userId } },
    { action, subject: 'Task', conditions: { userId } },
  ];
}

function scopeCustomTaskPermission(
  action: AbilityAction,
  subjectName: AbilitySubject,
  userId: string,
  conditions: Record<string, unknown> | undefined,
): AppRule[] {
  if (subjectName !== 'Task' || action === 'create') {
    return [{ action, subject: subjectName, ...(conditions ? { conditions } : {}) }];
  }

  return [
    { action, subject: subjectName, conditions: { ...conditions, createdById: userId } },
    { action, subject: subjectName, conditions: { ...conditions, userId } },
  ];
}

function bindCurrentUser(value: unknown, userId: string): unknown {
  if (value === '$currentUserId') return userId;
  if (Array.isArray(value)) return value.map((item) => bindCurrentUser(item, userId));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, bindCurrentUser(item, userId)]),
    );
  }
  return value;
}

@Injectable()
export class AbilityFactory {
  constructor(private readonly prisma: PrismaService) {}

  async rulesForUser(user: AbilityUser): Promise<AppRule[]> {
    const role = await this.prisma.role.findUnique({
      where: user.customRoleId ? { id: user.customRoleId } : { name: user.role },
      include: { permissions: { select: { action: true, subject: true, conditions: true } } },
    });
    if (!role) return [];

    return role.permissions.flatMap((permission) => {
      const action = permission.action as AbilityAction;
      const subjectName = permission.subject as AbilitySubject;
      const storedConditions = permission.conditions
        ? JSON.parse(permission.conditions) as Record<string, unknown>
        : undefined;

      if (!role.isSystem && subjectName === 'all') return [];
      if (role.isSystem && storedConditions?.scope === 'TASK_PARTICIPANT') {
        return taskVisibilityRules(action, user.id);
      }

      const conditions = storedConditions
        ? bindCurrentUser(storedConditions, user.id) as Record<string, unknown>
        : undefined;
      if (!role.isSystem) {
        const rules = scopeCustomTaskPermission(action, subjectName, user.id, conditions);
        // A conditional manage rule cannot authorize create without a task
        // subject. Keep create explicit while scoping every existing task.
        return action === 'manage' && subjectName === 'Task'
          ? [...rules, { action: 'create', subject: 'Task' }]
          : rules;
      }

      return [{ action, subject: subjectName, ...(conditions ? { conditions } : {}) }];
    });
  }

  async createForUser(user: AbilityUser): Promise<AppAbility> {
    return createMongoAbility<[AbilityAction, AbilitySubject]>(await this.rulesForUser(user) as never[]);
  }
}
