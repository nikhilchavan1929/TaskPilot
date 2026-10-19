import { useEffect, useState, type FormEvent } from 'react';
import { apiClient } from '../../shared/api/client';
import type { AbilityRule, RoleRecord } from '../../shared/api/types';

const permissionChoices = [
  { action: 'read', subject: 'Task', label: 'Read tasks' },
  { action: 'create', subject: 'Task', label: 'Create tasks' },
  { action: 'update', subject: 'Task', label: 'Edit tasks' },
  { action: 'delete', subject: 'Task', label: 'Delete tasks' },
  { action: 'complete', subject: 'Task', label: 'Complete assigned tasks' },
  { action: 'read', subject: 'User', label: 'Read users' },
  { action: 'manage', subject: 'User', label: 'Manage users and roles' },
  { action: 'manage', subject: 'Role', label: 'Manage roles' },
];

export function RolesPage() {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<string[]>(['read:Task', 'complete:Task']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadRoles() {
    const { data } = await apiClient.get<RoleRecord[]>('/roles');
    setRoles(data);
  }

  useEffect(() => {
    let active = true;
    void apiClient.get<RoleRecord[]>('/roles').then(({ data }) => { if (active) setRoles(data); })
      .catch(() => { if (active) setError('Could not load roles.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function createRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError('Role name must contain at least 2 non-space characters.');
      return;
    }
    setSaving(true);
    setError('');
    const permissions: AbilityRule[] = permissionChoices
      .filter((permission) => selected.includes(`${permission.action}:${permission.subject}`))
      .map(({ action, subject }) => ({ action, subject }));
    try {
      await apiClient.post('/roles', { name: name.trim(), description, permissions });
      setName('');
      setDescription('');
      setSelected([]);
      await loadRoles();
    } catch {
      setError('Could not create the role. Choose a unique name and at least one permission.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRole(role: RoleRecord) {
    if (role.isSystem) return;
    setError('');
    try {
      await apiClient.delete(`/roles/${role.id}`);
      setRoles((current) => current.filter((item) => item.id !== role.id));
    } catch {
      setError('Could not delete that role.');
    }
  }

  return (
    <section className="page-card management-card">
      <p className="eyebrow">Access control</p>
      <h1>Roles & access</h1>
      <p className="muted-copy">Built-in Administrator has full access. Create custom roles by selecting CASL actions.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <form className="role-form" onSubmit={createRole}>
        <h2>Create a role</h2>
        <p className="field-hint"><span className="required-marker" aria-hidden="true">*</span> Required field</p>
        <div className="form-row">
          <div><label htmlFor="role-name">Role name <span className="required-marker" aria-hidden="true">*</span></label><input id="role-name" maxLength={50} minLength={2} onChange={(event) => setName(event.target.value)} required value={name} /></div>
          <div><label htmlFor="role-description">Description</label><input id="role-description" maxLength={200} onChange={(event) => setDescription(event.target.value)} value={description} /></div>
        </div>
        <fieldset className="permission-grid">
          <legend>Permissions <span className="required-marker" aria-hidden="true">*</span></legend>
          {permissionChoices.map((permission) => {
            const key = `${permission.action}:${permission.subject}`;
            return <label className="permission-option" key={key}><input checked={selected.includes(key)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, key] : current.filter((item) => item !== key))} type="checkbox" />{permission.label}</label>;
          })}
        </fieldset>
        <button className="primary-button submit-button" disabled={saving || selected.length === 0} type="submit">{saving ? 'Creating…' : 'Create role'}</button>
      </form>
      <div className="role-list">
        <h2>Available roles</h2>
        {loading ? <p>Loading roles…</p> : roles.map((role) => (
          <article className="role-row" key={role.id}>
            <div><strong>{role.name}</strong><p>{role.description || (role.isSystem ? 'Built-in role' : 'Custom role')}</p></div>
            <div className="role-row-end"><span>{role.isSystem ? 'System' : `${role.assignedUsers ?? 0} users`}</span>{!role.isSystem && <button className="quiet-button danger-button" onClick={() => void deleteRole(role)} type="button">Delete</button>}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
