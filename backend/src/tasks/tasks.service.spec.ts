import type { AuthenticatedUser } from '../auth/auth.types';
import type { AbilityFactory } from '../authorization/ability.factory';
import type { PrismaService } from '../database/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { TasksService } from './tasks.service';

describe('TasksService dashboard summary', () => {
  it('uses a stable tiebreaker when loading recent tasks', async () => {
    const groupBy = jest.fn().mockResolvedValue([]);
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { task: { groupBy, findMany } } as unknown as PrismaService;
    const abilityFactory = { createForUser: jest.fn().mockResolvedValue({ can: () => true }) } as unknown as AbilityFactory;
    const service = new TasksService(prisma, abilityFactory, {} as NotificationsService);
    const user = { id: 'manager-1', email: 'manager@example.com', role: 'MANAGER', customRoleId: null, sessionId: 'session-1' } as AuthenticatedUser;

    await service.summary(user);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 5,
    }));
  });
});