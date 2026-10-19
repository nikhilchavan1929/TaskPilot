import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../shared/api/client';
import { ProfilePage } from './ProfilePage';

const { updateProfileSpy } = vi.hoisted(() => ({ updateProfileSpy: vi.fn() }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ updateProfile: updateProfileSpy }) }));
vi.mock('../../shared/api/client', () => ({ apiClient: { get: vi.fn(), patch: vi.fn() } }));

const profile = {
  id: 'user-1', email: 'person@example.com', role: 'ADMIN', firstName: 'Ari', lastName: 'User',
  birthDate: '1997-04-08', avatarUrl: 'https://example.com/avatar.png',
};

describe('ProfilePage review fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({ data: profile } as never);
    vi.mocked(apiClient.patch).mockResolvedValue({ data: profile } as never);
  });

  it('sends empty name strings for backend normalization and only merges allowed profile fields into auth state', async () => {
    render(<ProfilePage />);
    fireEvent.change(await screen.findByLabelText('First name'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalled());
    expect(apiClient.patch).toHaveBeenCalledWith('/users/me', expect.objectContaining({ firstName: '' }));
    expect(updateProfileSpy).toHaveBeenCalledWith({ firstName: 'Ari', lastName: 'User', avatarUrl: 'https://example.com/avatar.png' });
    expect(updateProfileSpy.mock.calls[0][0]).not.toHaveProperty('role');
    expect(updateProfileSpy.mock.calls[0][0]).not.toHaveProperty('birthDate');
  });

  it('shows backend validation details instead of an image-url-only error', async () => {
    vi.mocked(apiClient.patch).mockRejectedValue({ isAxiosError: true, response: { status: 400, data: { message: 'birthDate must be a valid date' } } });
    render(<ProfilePage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Save profile' }));
    expect((await screen.findByRole('alert')).textContent).toContain('birthDate must be a valid date');
  });
});