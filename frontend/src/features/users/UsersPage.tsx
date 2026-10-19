import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useAbility } from '@casl/react';
import { apiClient } from '../../shared/api/client';
import type { RoleRecord, UserRecord } from '../../shared/api/types';
import type { TodoAbility } from '../../app/ability';
import { useAuth } from '../auth/AuthContext';

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const ability = useAbility<TodoAbility>();
  const canManageUsers = ability.can('manage', 'User');
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState('');
  const savedTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const usersRequest = apiClient.get<UserRecord[]>('/users').then(({ data }) => {
      if (!active) return;
      setUsers(data);
      setSelectedRoles(Object.fromEntries(data.map((person) => [person.id, person.customRoleId ?? person.role])));
    }).catch(() => { if (active) setError('Could not load the user list.'); });
    const rolesRequest = canManageUsers
      ? apiClient.get<RoleRecord[]>('/roles').then(({ data }) => { if (active) setRoles(data); })
        .catch(() => { if (active) setError('Users loaded, but roles could not be loaded.'); })
      : Promise.resolve();
    void Promise.all([usersRequest, rolesRequest]).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canManageUsers]);

  useEffect(() => () => {
    if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
  }, []);

  async function saveRole(user: UserRecord) {
    const selection = selectedRoles[user.id] ?? user.role;
    const selectedRole = roles.find((role) => role.isSystem
      ? role.name === selection
      : role.id === selection);
    if (!selectedRole) {
      setError('That role is unavailable. Reload the roles list and try again.');
      return;
    }
    const payload = selectedRole.isSystem
      ? { role: selectedRole.name, customRoleId: null }
      : { role: 'USER', customRoleId: selectedRole.id };
    setError('');
    try {
      await apiClient.patch(`/users/${user.id}/role`, payload);
      const custom = selectedRole.isSystem ? null : selectedRole;
      setUsers((current) => current.map((item) => item.id === user.id ? {
        ...item,
        role: custom ? 'USER' : selectedRole.name,
        customRoleId: custom?.id ?? null,
        customRole: custom ? { id: custom.id, name: custom.name } : null,
        roleName: selectedRole.name,
      } : item));
      if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
      setSavedId(user.id);
      savedTimer.current = window.setTimeout(() => {
        setSavedId('');
        savedTimer.current = null;
      }, 1800);
    } catch {
      setError('Could not update that user’s role.');
    }
  }

  async function deleteUser(user: UserRecord) {
    if (!window.confirm(`Delete the account for ${user.email}? Their tasks and sessions will also be removed.`)) return;
    setError('');
    try {
      await apiClient.delete(`/users/${user.id}`);
      setUsers((current) => current.filter((item) => item.id !== user.id));
    } catch (error) {
      if (isAxiosError<{ message?: string | string[] }>(error)) {
        const status = error.response?.status;
        const serverMessage = error.response?.data?.message;
        const message = Array.isArray(serverMessage) ? serverMessage.join(' ') : serverMessage;
        if (typeof message === 'string' && message.trim()) setError(message);
        else if (status === 401) setError('Your session expired. Sign in again and retry.');
        else if (status === 403) setError('You do not have permission to delete this account.');
        else if (status === 404) setError('This account no longer exists. Reload the user list.');
        else setError('Could not delete that account. Try again.');
      } else setError('Could not delete that account. Try again.');
    }
  }

  return (
    <section className="page-card management-card">
      <p className="eyebrow">Access control</p>
      <h1>Users</h1>
      <p className="muted-copy">Assign built-in or custom roles to registered accounts.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? <p role="status">Loading users…</p> : users.length === 0 ? <p>No users found.</p> : (
        <div className="user-list">
          {users.map((user) => (
            <article className="user-row" key={user.id}>
              <div className="user-summary">
                {user.avatarUrl ? <img className="avatar" src={user.avatarUrl} alt="" /> : <span className="avatar avatar-fallback">{user.firstName?.[0] ?? user.email[0]}</span>}
                <div><strong>{[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}</strong><span>{user.email}</span></div>
              </div>
              <div className="role-editor">
                {canManageUsers ? (
                  <>
                    <select aria-label={`Role for ${user.email}`} onChange={(event) => setSelectedRoles((current) => ({ ...current, [user.id]: event.target.value }))} value={selectedRoles[user.id] ?? user.role}>
                      {roles.filter((role) => role.isSystem).map((role) => <option key={role.id} value={role.name}>{role.name}</option>)}
                      {roles.filter((role) => !role.isSystem).map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </select>
                    <button className="quiet-button" onClick={() => void saveRole(user)} type="button">{savedId === user.id ? 'Saved' : 'Save role'}</button>
                    {currentUser?.id !== user.id && <button className="quiet-button danger-button" onClick={() => void deleteUser(user)} type="button">Delete</button>}
                  </>
                ) : <span className="role-pill">{user.roleName ?? user.role}</span>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
