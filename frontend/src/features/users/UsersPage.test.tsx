import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../shared/api/client';
import { UsersPage } from './UsersPage';

vi.mock('@casl/react', () => ({ useAbility: () => ({ can: () => true }) }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin-1', email: 'admin@example.com' } }) }));
vi.mock('../../shared/api/client', () => ({ apiClient: { get: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

const users = [
  { id: 'user-1', email: 'person@example.com', role: 'USER', firstName: 'Ari', lastName: 'User', customRoleId: null, customRole: null },
];

describe('UsersPage review fixes', () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url === '/users') return Promise.resolve({ data: users }) as never;
      if (url === '/roles') return Promise.resolve({ data: [] }) as never;
      return Promise.resolve({ data: [] }) as never;
    });
  });

  it('keeps users visible when loading roles fails', async () => {
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url === '/users') return Promise.resolve({ data: users }) as never;
      if (url === '/roles') return Promise.reject(new Error('Roles unavailable')) as never;
      return Promise.resolve({ data: [] }) as never;
    });
    render(<UsersPage />);
    expect(await screen.findByText('person@example.com')).toBeTruthy();
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('shows a generic delete error when the server fails for a reason other than the last-admin rule', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(apiClient.delete).mockRejectedValue({ isAxiosError: true, response: { status: 500, data: {} } });
    render(<UsersPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Try again');
    expect(alert.textContent).not.toContain('last administrator');
  });

  it('clears the prior saved timer when another user role is saved', async () => {
    const twoUsers = [...users, { ...users[0], id: 'user-2', email: 'second@example.com' }];
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url === '/users') return Promise.resolve({ data: twoUsers }) as never;
      if (url === '/roles') return Promise.resolve({ data: [{ id: 'role-user', name: 'USER', isSystem: true, assignedUsers: 2, permissions: [] }] }) as never;
      return Promise.resolve({ data: [] }) as never;
    });
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} } as never);
    render(<UsersPage />);
    await screen.findByText('second@example.com');
    vi.useFakeTimers();
    const saveButtons = screen.getAllByRole('button', { name: 'Save role' });
    await act(async () => { fireEvent.click(saveButtons[0]); await Promise.resolve(); });
    expect(screen.getByRole('button', { name: 'Saved' })).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Save role' })[0]); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    const rows = screen.getAllByRole('article');
    expect(within(rows[1]).getByRole('button', { name: 'Saved' })).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  });
});