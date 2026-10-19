import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../api/client';
import { AuthProvider, useAuth } from '../../features/auth/AuthContext';
import { AppLayout } from './AppLayout';
import type { AuthResponse } from '../api/types';

vi.mock('@casl/react', () => ({ useAbility: () => ({ can: () => false }) }));
vi.mock('../api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const auth: AuthResponse = {
  accessToken: 'user-access-token',
  user: { id: 'user-1', email: 'person@example.com', role: 'USER', permissions: [] },
};

function LoginControl() {
  const { login } = useAuth();
  return <button onClick={() => void login({ email: auth.user.email, password: 'example-password' })} type="button">Sign in again</button>;
}

describe('AppLayout logout warning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [], unreadCount: 0 } } as never);
    vi.mocked(apiClient.post).mockImplementation((url) => {
      if (url === '/auth/refresh') return Promise.reject(new Error('No session')) as never;
      if (url === '/auth/login') return Promise.resolve({ data: auth }) as never;
      if (url === '/auth/logout') return Promise.reject(new Error('Logout unavailable')) as never;
      return Promise.resolve({ data: {} }) as never;
    });
  });

  it('clears an old logout warning after the user signs in again', async () => {
    render(<AuthProvider><MemoryRouter><AppLayout /><LoginControl /></MemoryRouter></AuthProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in again' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    const warning = await screen.findByRole('alert');
    expect(warning.textContent).toContain('You were signed out here');

    fireEvent.click(screen.getByRole('button', { name: 'Sign in again' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});
