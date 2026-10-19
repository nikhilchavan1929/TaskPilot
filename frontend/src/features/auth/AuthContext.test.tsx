import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../shared/api/client';
import { getAccessToken, setAccessToken } from '../../shared/api/access-token';
import type { AuthResponse } from '../../shared/api/types';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('../../shared/api/client', () => ({ apiClient: { post: vi.fn() } }));

const auth: AuthResponse = {
  accessToken: 'active-token',
  user: { id: 'user-1', email: 'user@example.com', role: 'USER', permissions: [] },
};

function Controls() {
  const { status, login, logout } = useAuth();
  return <>
    <output data-testid="status">{status}</output>
    <button onClick={() => void login({ email: auth.user.email, password: 'placeholder-password' })} type="button">Login</button>
    <button onClick={() => void logout().catch(() => undefined)} type="button">Logout</button>
  </>;
}

describe('AuthProvider session safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAccessToken(null);
    vi.mocked(apiClient.post).mockImplementation((url) => {
      if (url === '/auth/refresh') return Promise.reject(new Error('No session')) as never;
      if (url === '/auth/login') return Promise.resolve({ data: auth }) as never;
      return Promise.resolve({ data: {} }) as never;
    });
  });

  it('ignores expiration for an older token and clears the matching current session', async () => {
    render(<AuthProvider><Controls /></AuthProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Login' }));
    await waitFor(() => expect(getAccessToken()).toBe('active-token'));

    act(() => window.dispatchEvent(new CustomEvent('todo:session-expired', { detail: { accessToken: 'older-token' } })));
    expect(screen.getByTestId('status').textContent).toBe('authenticated');

    act(() => window.dispatchEvent(new CustomEvent('todo:session-expired', { detail: { accessToken: 'active-token' } })));
    expect(screen.getByTestId('status').textContent).toBe('anonymous');
    expect(getAccessToken()).toBeNull();
  });

  it('keeps the access token until the server logout attempt finishes', async () => {
    let finishLogout: (() => void) | undefined;
    vi.mocked(apiClient.post).mockImplementation((url) => {
      if (url === '/auth/refresh') return Promise.reject(new Error('No session')) as never;
      if (url === '/auth/login') return Promise.resolve({ data: auth }) as never;
      if (url === '/auth/logout') return new Promise((resolve) => { finishLogout = () => resolve({ data: {} }); }) as never;
      return Promise.resolve({ data: {} }) as never;
    });
    render(<AuthProvider><Controls /></AuthProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Login' }));
    await waitFor(() => expect(getAccessToken()).toBe('active-token'));
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    await waitFor(() => expect(finishLogout).toBeDefined());
    expect(getAccessToken()).toBe('active-token');
    await act(async () => { finishLogout?.(); });
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));
  });
});