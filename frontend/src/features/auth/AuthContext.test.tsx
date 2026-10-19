import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../shared/api/client';
import { getAccessToken, setAccessToken } from '../../shared/api/access-token';
import type { AuthResponse } from '../../shared/api/types';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('../../shared/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const auth: AuthResponse = {
  accessToken: 'fresh-access-token',
  user: { id: 'user-1', email: 'person@example.com', role: 'USER', permissions: [] },
};

function AuthControls() {
  const { status, login } = useAuth();
  return <>
    <output data-testid="auth-status">{status}</output>
    <button onClick={() => void login({ email: auth.user.email, password: 'example-password' })} type="button">
      Sign in
    </button>
  </>;
}

describe('AuthProvider session races', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    setAccessToken(null);
  });

  it('does not apply a login that finishes after the session expires', async () => {
    let resolveLogin: ((response: { data: AuthResponse }) => void) | undefined;
    vi.mocked(apiClient.post).mockImplementation((url) => {
      if (url === '/auth/refresh') return Promise.reject(new Error('No session')) as never;
      if (url === '/auth/login') {
        return new Promise((resolve) => { resolveLogin = resolve; }) as never;
      }
      return Promise.resolve({ data: {} }) as never;
    });

    render(<AuthProvider><AuthControls /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('auth-status').textContent).toBe('anonymous'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(resolveLogin).toBeDefined());

    act(() => window.dispatchEvent(new Event('todo:session-expired')));
    await act(async () => { resolveLogin?.({ data: auth }); });

    expect(screen.getByTestId('auth-status').textContent).toBe('anonymous');
    expect(getAccessToken()).toBeNull();
  });

  it('ignores an expiration event for an older access token', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: auth } as never);
    render(<AuthProvider><AuthControls /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('auth-status').textContent).toBe('authenticated'));

    act(() => window.dispatchEvent(new CustomEvent('todo:session-expired', {
      detail: { accessToken: 'older-access-token' },
    })));

    expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');
    expect(getAccessToken()).toBe(auth.accessToken);
  });
});
