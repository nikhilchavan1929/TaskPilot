import { subject } from '@casl/ability';
import { AbilityFactory } from './ability.factory';
import type { PrismaService } from '../database/prisma.service';

describe('AbilityFactory', () => {
  const storedRoles = [
    {
      id: 'system-admin',
      name: 'ADMIN',
      isSystem: true,
      permissions: [{ action: 'manage', subject: 'all', conditions: null }],
    },
    {
      id: 'system-manager',
      name: 'MANAGER',
      isSystem: true,
      permissions: [
        { action: 'create', subject: 'Task', conditions: null },
        { action: 'manage', subject: 'Task', conditions: JSON.stringify({ scope: 'TASK_PARTICIPANT' }) },
        { action: 'read', subject: 'User', conditions: null },
      ],
    },
    {
      id: 'system-user',
      name: 'USER',
      isSystem: true,
      permissions: [
        { action: 'read', subject: 'Task', conditions: JSON.stringify({ userId: '$currentUserId' }) },
        { action: 'complete', subject: 'Task', conditions: JSON.stringify({ userId: '$currentUserId' }) },
      ],
    },
    {
      id: 'role-1',
      name: 'READER',
      isSystem: false,
      permissions: [{ action: 'read', subject: 'Task', conditions: null }],
    },
  ];
  const prisma = {
    role: {
      findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve(
        storedRoles.find((role) => (where.id ? role.id === where.id : role.name === where.name)) ?? null,
      )),
    },
  } as unknown as PrismaService;
  const factory = new AbilityFactory(prisma);

  it('gives administrators full access', async () => {
    const ability = await factory.createForUser({ id: 'admin', role: 'ADMIN' });
    expect(ability.can('manage', 'Role')).toBe(true);
    expect(ability.can('delete', 'User')).toBe(true);
    expect(ability.can('update', 'Task')).toBe(true);
    expect(ability.can('complete', 'Task')).toBe(true);
  });

  it('lets managers manage tasks and read users without role administration', async () => {
    const ability = await factory.createForUser({ id: 'manager', role: 'MANAGER' });
    expect(ability.can('create', 'Task')).toBe(true);
    const taskManagerCreated = subject('Task', { createdById: 'manager', userId: 'assignee' }) as unknown as 'Task';
    const taskAssignedToManager = subject('Task', { createdById: 'other', userId: 'manager' }) as unknown as 'Task';
    const unrelatedTask = subject('Task', { createdById: 'other', userId: 'another-user' }) as unknown as 'Task';
    expect(ability.can('update', taskManagerCreated)).toBe(true);
    expect(ability.can('complete', taskAssignedToManager)).toBe(true);
    expect(ability.can('read', unrelatedTask)).toBe(false);
    expect(ability.can('read', 'User')).toBe(true);
    expect(ability.can('manage', 'Role')).toBe(false);
  });

  it('limits normal users to reading and completing their own tasks', async () => {
    const ability = await factory.createForUser({ id: 'user-1', role: 'USER' });
    const ownTask = subject('Task', { userId: 'user-1' }) as unknown as 'Task';
    const anotherTask = subject('Task', { userId: 'user-2' }) as unknown as 'Task';
    expect(ability.can('read', ownTask)).toBe(true);
    expect(ability.can('complete', ownTask)).toBe(true);
    expect(ability.can('read', anotherTask)).toBe(false);
    expect(ability.can('update', ownTask)).toBe(false);
    expect(ability.can('delete', ownTask)).toBe(false);
  });

  it('loads custom permissions from the role permission records', async () => {
    const ability = await factory.createForUser({ id: 'user-1', role: 'USER', customRoleId: 'role-1' });
    const ownTask = subject('Task', { userId: 'user-1' }) as unknown as 'Task';
    const taskCreatedByUser = subject('Task', { createdById: 'user-1', userId: 'user-2' }) as unknown as 'Task';
    const unrelatedTask = subject('Task', { createdById: 'user-2', userId: 'user-3' }) as unknown as 'Task';
    expect(ability.can('read', ownTask)).toBe(true);
    expect(ability.can('read', taskCreatedByUser)).toBe(true);
    expect(ability.can('read', unrelatedTask)).toBe(false);
    expect(ability.can('create', 'Task')).toBe(false);
  });
});
