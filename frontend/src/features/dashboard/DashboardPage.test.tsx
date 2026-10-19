import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { apiClient } from '../../shared/api/client';
import type { TaskDashboardSummary } from '../../shared/api/types';
import { DashboardPage } from './DashboardPage';

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1', email: 'person@example.com', firstName: 'Ari' } }) }));
vi.mock('../../shared/api/client', () => ({ apiClient: { get: vi.fn() } }));

function summary(title: string): TaskDashboardSummary {
  return {
    total: 1,
    counts: { PENDING: 1, IN_PROGRESS: 0, COMPLETED: 0 },
    recentTasks: [{
      id: title, title, description: null, status: 'PENDING', userId: 'user-1', createdById: 'user-1', dueAt: null,
      createdAt: '2026-10-20T08:00:00.000Z', updatedAt: '2026-10-20T08:00:00.000Z',
    }],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((complete, fail) => { resolve = complete; reject = fail; });
  return { promise, resolve, reject };
}

describe('DashboardPage requests', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clears stale metrics and tasks after a retry fails', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: summary('Previously loaded task') } as never)
      .mockRejectedValueOnce(new Error('Unavailable'));
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    await screen.findByText('Previously loaded task');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh overview' }));
    await screen.findByRole('alert');
    expect(screen.queryByText('Previously loaded task')).toBeNull();
    expect(screen.queryByText('No tasks yet.')).toBeNull();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getByText('Progress unavailable')).toBeTruthy();
  });

  it('ignores older summary responses that finish after a newer retry', async () => {
    const older = deferred<{ data: TaskDashboardSummary }>();
    const newer = deferred<{ data: TaskDashboardSummary }>();
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: summary('Initial task') } as never)
      .mockImplementationOnce(() => older.promise as never)
      .mockImplementationOnce(() => newer.promise as never);
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    await screen.findByText('Initial task');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh overview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh overview' }));
    await act(async () => { newer.resolve({ data: summary('Latest task') }); });
    await screen.findByText('Latest task');
    await act(async () => { older.resolve({ data: summary('Stale task') }); });
    await waitFor(() => expect(screen.getByText('Latest task')).toBeTruthy());
    expect(screen.queryByText('Stale task')).toBeNull();
  });
});