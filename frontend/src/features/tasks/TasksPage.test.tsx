import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../shared/api/client';
import type { PaginatedTasks, TaskActivityItem, TaskItem } from '../../shared/api/types';
import { TasksPage } from './TasksPage';

vi.mock('@casl/react', () => ({
  useAbility: () => ({ can: (action: string) => action === 'read' || action === 'complete' }),
}));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'person@example.com', role: 'USER' } }),
}));
vi.mock('../../shared/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const task: TaskItem = {
  id: 'task-1', title: 'Prepare release', description: null, status: 'PENDING',
  userId: 'user-1', createdById: 'manager-1', dueAt: null,
  createdAt: '2026-10-20T08:00:00.000Z', updatedAt: '2026-10-20T08:00:00.000Z',
  user: { id: 'user-1', email: 'person@example.com', firstName: 'Ari', lastName: 'User' },
};

const page: PaginatedTasks = { items: [task], page: 1, limit: 20, total: 1, pageCount: 1 };

describe('task activity timeline', () => {
  let activityRequests = 0;

  beforeEach(() => {
    activityRequests = 0;
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url === '/tasks') return Promise.resolve({ data: page }) as never;
      if (url === '/tasks/task-1/activity') {
        activityRequests += 1;
        const item: TaskActivityItem = {
          id: `activity-${activityRequests}`,
          action: activityRequests === 1 ? 'CREATED' : 'COMPLETED',
          summary: activityRequests === 1 ? 'Created this task' : 'Marked this task complete',
          createdAt: '2026-10-20T08:10:00.000Z',
          actor: { id: 'user-1', firstName: 'Ari', lastName: 'User' },
        };
        return Promise.resolve({ data: [item] }) as never;
      }
      return Promise.resolve({ data: [] }) as never;
    });
    vi.mocked(apiClient.patch).mockResolvedValue({ data: task } as never);
  });

  it('refetches when reopened and refreshes an expanded timeline after completion', async () => {
    render(<TasksPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'View activity' }));
    await screen.findByText('Created this task');
    expect(activityRequests).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Hide activity' }));
    fireEvent.click(screen.getByRole('button', { name: 'View activity' }));
    await waitFor(() => expect(activityRequests).toBe(2));

    fireEvent.click(screen.getByRole('button', { name: 'Mark complete' }));
    await waitFor(() => expect(activityRequests).toBe(3));
    await screen.findByText('Marked this task complete');
  });
});
