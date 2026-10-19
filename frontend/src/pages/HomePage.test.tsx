import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage';

vi.mock('@casl/react', () => ({ useAbility: () => ({ can: () => false }) }));
vi.mock('../features/auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1', email: 'person@example.com' }, status: 'authenticated' }) }));
vi.mock('../features/health/HealthPanel', () => ({ HealthPanel: () => <span>API status</span> }));

describe('HomePage permissions', () => {
  it('offers profile navigation instead of a dashboard the user cannot read', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    const link = screen.getByRole('link', { name: 'Open profile' });
    expect(link.getAttribute('href')).toBe('/profile');
    expect(screen.queryByRole('link', { name: 'Open dashboard' })).toBeNull();
  });
});