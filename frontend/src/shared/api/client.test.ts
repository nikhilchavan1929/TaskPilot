import { beforeEach, describe, expect, it } from 'vitest';
import { getAccessToken, setAccessToken } from './access-token';
import { applyRefreshFailure, applyRefreshResult } from './client';

describe('refresh token race protection', () => {
  beforeEach(() => setAccessToken(null));

  it('does not overwrite a newer login with an old refresh response', () => {
    setAccessToken('new-session-token');
    expect(applyRefreshResult('expired-session-token', 'late-refresh-token')).toBe('new-session-token');
    expect(getAccessToken()).toBe('new-session-token');
  });

  it('applies a refresh result when the request still belongs to the active session', () => {
    setAccessToken('expired-session-token');
    expect(applyRefreshResult('expired-session-token', 'refreshed-token')).toBe('refreshed-token');
    expect(getAccessToken()).toBe('refreshed-token');
  });

  it('does not expire a newer login when an old refresh request fails', () => {
    setAccessToken('new-session-token');
    expect(applyRefreshFailure('expired-session-token')).toBe('new-session-token');
    expect(getAccessToken()).toBe('new-session-token');
  });
});
