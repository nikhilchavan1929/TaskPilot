import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../shared/api/client';
import type { PaginatedTasks, TaskItem } from '../../shared/api/types';
import { TasksPage } from './TasksPage';

vi.mock('@casl/react', () => ({ useAbility: () => ({ can: (action: string) => action !== 'manage' }) }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1', email: 'person@example.com', firstName: 'Ari', role: 'USER' } }) }));
vi.mock('../../shared/api/client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

function task(id: string, title: string): TaskItem {
  return {
    id, title, description: null, status: 'PENDING', userId: 'user-1', createdById: 'user-1', dueAt: null,
    createdAt: '2026-10-20T08:00:00.000Z', updatedAt: '2026-10-20T08:00:00.000Z',
    user: { id: 'user-1', email: 'person@example.com', firstName: 'Ari', lastName: 'User' },
  };
}

function page(items: TaskItem[], pageNumber = 1, pageCount = 1): PaginatedTasks {
  return { items, page: pageNumber, limit: 20, total: pageCount * 20, pageCount };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

describe('TasksPage request ordering', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps the latest filtered response when an older request resolves later', async () => {
    const older = deferred<{ data: PaginatedTasks }>();
    const newer = deferred<{ data: PaginatedTasks }>();
    let request = 0;
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url === '/tasks') return (++request === 1 ? older.promise : newer.promise) as never;
      return Promise.resolve({ data: [] }) as never;
    });
    render(<TasksPage />);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'new' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search tasks' }));
    await waitFor(() => expect(request).toBe(2));
    await act(async () => { newer.resolve({ data: page([task('new', 'New result')]) }); });
    await act(async () => { older.resolve({ data: page([task('old', 'Old result')]) }); });
    expect(await screen.findByText('New result')).toBeTruthy();
    expect(screen.queryByText('Old result')).toBeNull();
  });

  it('returns to page one after creating a task from a later page', async () => {
    const requests: Array<{ page: number }> = [];
    vi.mocked(apiClient.get).mockImplementation((url, config) => {
      if (url !== '/tasks') return Promise.resolve({ data: [] }) as never;
      const params = config?.params as { page: number };
      requests.push(params);
      return Promise.resolve({ data: page([task(`task-${params.page}`, `Page ${params.page} task`)], params.page, 2) }) as never;
    });
    vi.mocked(apiClient.post).mockResolvedValue({ data: task('new-task', 'New task') } as never);
    render(<TasksPage />);
    await screen.findByText('Page 1 task');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 task');
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Created from page two' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
    await waitFor(() => expect(requests.filter((item) => item.page === 1).length).toBeGreaterThan(1));
    expect(requests.at(-1)?.page).toBe(1);
  });

  it('submits edits by the task id even if the current list no longer contains it', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: page([task('task-edit', 'Editable task')]) } as never);
    vi.mocked(apiClient.patch).mockResolvedValue({ data: task('task-edit', 'Updated task') } as never);
    render(<TasksPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(document.querySelector<HTMLInputElement>('#edit-title-task-edit')!, { target: { value: 'Updated task' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith('/tasks/task-edit', expect.objectContaining({ title: 'Updated task' })));
  });
});