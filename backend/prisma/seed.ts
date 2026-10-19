import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  }),
});

const SYSTEM_ROLES = [
  {
    id: 'system-role-admin',
    name: 'ADMIN',
    description: 'Full access to all features.',
    permissions: [
      { action: 'manage', subject: 'all', conditions: null },
      { action: 'complete', subject: 'Task', conditions: null },
    ],
  },
  {
    id: 'system-role-manager',
    name: 'MANAGER',
    description: 'Create and manage tasks they assign or receive.',
    permissions: [
      { action: 'create', subject: 'Task', conditions: null },
      { action: 'manage', subject: 'Task', conditions: JSON.stringify({ scope: 'TASK_PARTICIPANT' }) },
      { action: 'read', subject: 'User', conditions: null },
    ],
  },
  {
    id: 'system-role-user',
    name: 'USER',
    description: 'Read and complete assigned tasks.',
    permissions: [
      { action: 'read', subject: 'Task', conditions: JSON.stringify({ userId: '$currentUserId' }) },
      { action: 'complete', subject: 'Task', conditions: JSON.stringify({ userId: '$currentUserId' }) },
    ],
  },
] as const;

async function seedSystemRoles(): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    for (const roleSeed of SYSTEM_ROLES) {
      const existing = await transaction.role.findUnique({ where: { name: roleSeed.name } });
      if (existing && !existing.isSystem) {
        throw new Error(`Cannot seed system role ${roleSeed.name}: a custom role already uses that name.`);
      }

      const role = await transaction.role.upsert({
        where: { name: roleSeed.name },
        create: {
          id: roleSeed.id,
          name: roleSeed.name,
          description: roleSeed.description,
          isSystem: true,
        },
        update: {
          description: roleSeed.description,
          isSystem: true,
        },
      });

      await transaction.rolePermission.deleteMany({ where: { roleId: role.id } });
      for (const permission of roleSeed.permissions) {
        await transaction.rolePermission.create({
          data: {
            roleId: role.id,
            action: permission.action,
            subject: permission.subject,
            conditions: permission.conditions,
          },
        });
      }
    }
  });
}

seedSystemRoles()
  .then(async () => {
    console.log('System roles and permissions are ready.');
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error('Could not seed system roles.', error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
