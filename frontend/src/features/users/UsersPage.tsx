import { useEffect, useState } from 'react';
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

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiClient.get<UserRecord[]>('/users'),
      canManageUsers ? apiClient.get<RoleRecord[]>('/roles') : Promise.resolve({ data: [] as RoleRecord[] }),
    ]).then(([userResponse, roleResponse]) => {
      if (!active) return;
      setUsers(userResponse.data);
      setRoles(roleResponse.data);
      setSelectedRoles(Object.fromEntries(userResponse.data.map((user) => [user.id, user.customRoleId ?? user.role])));
    }).catch(() => { if (active) setError('Could not load the user list.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canManageUsers]);

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
      setSavedId(user.id);
      window.setTimeout(() => setSavedId(''), 1800);
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
    } catch {
      setError('Could not delete that account. The last administrator cannot be deleted.');
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
