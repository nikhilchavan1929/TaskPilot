import { describe, expect, it } from 'vitest';
import { destinationForUser, messageFromError } from './AuthPage';
import type { AuthUser } from '../../shared/api/types';

const user: AuthUser = { id: 'person-1', email: 'person@example.com', role: 'USER', permissions: [] };

describe('authentication redirects and errors', () => {
  it('sends users without task access to their profile instead of a forbidden task page', () => {
    expect(destinationForUser(user, { pathname: '/tasks', search: '?page=2' })).toBe('/profile');
  });

  it('preserves the intended task destination for a user with task read access', () => {
    const taskReader = { ...user, permissions: [{ action: 'read', subject: 'Task' }] };
    expect(destinationForUser(taskReader, { pathname: '/tasks', search: '?page=2' })).toEqual({ pathname: '/tasks', search: '?page=2', hash: '' });
  });

  it('shows server validation details for 400 responses and a specific fallback for other 4xx errors', () => {
    const validationError = { isAxiosError: true, response: { status: 400, data: { message: ['Email is invalid.', 'Password is too short.'] } } };
    const missingError = { isAxiosError: true, response: { status: 404, data: {} } };
    expect(messageFromError(validationError)).toBe('Email is invalid. Password is too short.');
    expect(messageFromError(missingError)).toContain('(404)');
  });
});