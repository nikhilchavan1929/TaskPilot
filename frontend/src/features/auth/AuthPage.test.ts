import { describe, expect, it } from 'vitest';
import { messageFromError } from './AuthPage';

describe('authentication error messages', () => {
  it('shows server validation details for a 400 response', () => {
    const error = {
      isAxiosError: true,
      response: { status: 400, data: { message: ['Password must be at least 12 characters.'] } },
    };

    expect(messageFromError(error)).toBe('Password must be at least 12 characters.');
  });

  it('uses a form-specific message when the server has no validation details', () => {
    const error = { isAxiosError: true, response: { status: 400, data: {} } };

    expect(messageFromError(error)).toBe('Please check the form details and try again.');
  });
});
