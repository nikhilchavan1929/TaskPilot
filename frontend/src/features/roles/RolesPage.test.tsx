import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../shared/api/client';
import { RolesPage } from './RolesPage';

vi.mock('../../shared/api/client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

const role = { id: 'custom-1', name: 'Reviewer', description: 'Reviews tasks', isSystem: false, assignedUsers: 3, permissions: [] };

describe('RolesPage review fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] } as never);
  });

  it('reports a role-list refresh error separately after the role was created', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: [] } as never)
      .mockRejectedValueOnce(new Error('Refresh failed'));
    vi.mocked(apiClient.post).mockResolvedValue({ data: role } as never);
    render(<RolesPage />);
    fireEvent.change(screen.getByLabelText('Role name *'), { target: { value: 'Reviewer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create role' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Role changes were saved');
    expect(alert.textContent).not.toContain('Could not create the role');
  });

  it('asks for confirmation and includes the assigned-user count before deleting a role', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.mocked(apiClient.get).mockResolvedValue({ data: [role] } as never);
    render(<RolesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(confirm.mock.calls[0][0]).toContain('3 users');
    expect(apiClient.delete).not.toHaveBeenCalled();
  });
});