import { createMongoAbility, type MongoAbility, subject } from '@casl/ability';
import type { AuthUser } from '../shared/api/types';

export type TodoAction = 'manage' | 'create' | 'read' | 'update' | 'delete' | 'complete';
export type TodoSubject = 'Task' | 'User' | 'Role' | 'all';
export type TodoAbilities = [TodoAction, TodoSubject];
export type TodoAbility = MongoAbility<TodoAbilities>;

export function createAbilityForUser(user: AuthUser | null): TodoAbility {
  const rules = (user?.permissions ?? []) as never[];
  return createMongoAbility<TodoAbilities>(rules);
}

export function taskSubject(userId: string, extra: Record<string, unknown> = {}): TodoSubject {
  return subject('Task', { userId, ...extra }) as unknown as TodoSubject;
}
