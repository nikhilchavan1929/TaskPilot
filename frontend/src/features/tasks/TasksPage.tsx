import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAbility } from '@casl/react';
import { apiClient } from '../../shared/api/client';
import type { PaginatedTasks, TaskActivityItem, TaskItem, TaskStatus, UserRecord } from '../../shared/api/types';
import { taskSubject, type TodoAbility } from '../../app/ability';
import { useAuth } from '../auth/AuthContext';

const initialPage: PaginatedTasks = { items: [], page: 1, limit: 20, total: 0, pageCount: 0 };

export function TasksPage() {
  const ability = useAbility<TodoAbility>();
  const { user } = useAuth();
  const canCreate = ability.can('create', 'Task');
  const canAssign = Boolean(user && ability.can(
    'manage',
    taskSubject(user.id, { createdById: user.id }),
  ));
  const [result, setResult] = useState(initialPage);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createOwnerId, setCreateOwnerId] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<TaskStatus>('PENDING');
  const [activityByTask, setActivityByTask] = useState<Record<string, TaskActivityItem[]>>({});
  const [expandedActivity, setExpandedActivity] = useState<Record<string, boolean>>({});
  const [activityLoading, setActivityLoading] = useState<Record<string, boolean>>({});
  const [activityErrors, setActivityErrors] = useState<Record<string, string>>({});
  const assignableUsers = users.filter((person) => person.id !== user?.id && person.role.toUpperCase() !== 'ADMIN');
  const currentUserName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'you';

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get<PaginatedTasks>('/tasks', {
        params: { page, limit: 20, search: search || undefined, status: statusFilter || undefined },
      });
      setResult(data);
    } catch {
      setError('Could not load tasks. Try again.');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { void loadTasks(); }, [loadTasks]);

  useEffect(() => {
    if (!canAssign) return;
    void apiClient.get<UserRecord[]>('/users').then(({ data }) => setUsers(data)).catch(() => setUsers([]));
  }, [canAssign]);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createTitle.trim()) {
      setError('Task title is required.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      await apiClient.post('/tasks', {
        title: createTitle.trim(),
        description: createDescription || undefined,
        userId: createOwnerId || undefined,
      });
      setCreateTitle('');
      setCreateDescription('');
      setCreateOwnerId('');
      setPage(1);
      await loadTasks();
    } catch {
      setError('Could not create the task. Check that the owner is still an active user.');
    } finally {
      setCreating(false);
    }
  }

  function beginEdit(task: TaskItem) {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description ?? '');
    setEditStatus(task.status);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTitle.trim()) {
      setError('Task title is required.');
      return;
    }
    const task = result.items.find((item) => item.id === editingId);
    if (!task) return;
    setError('');
    try {
      await apiClient.patch(`/tasks/${task.id}`, {
        title: editTitle.trim(),
        description: editDescription || null,
        status: editStatus,
      });
      setEditingId('');
      await loadTasks();
    } catch {
      setError('Could not update the task.');
    }
  }

  async function completeTask(task: TaskItem) {
    setError('');
    try {
      await apiClient.patch(`/tasks/${task.id}`, { status: 'COMPLETED' });
      await loadTasks();
    } catch {
      setError('Could not complete that task.');
    }
  }

  async function deleteTask(task: TaskItem) {
    setError('');
    try {
      await apiClient.delete(`/tasks/${task.id}`);
      await loadTasks();
    } catch {
      setError('Could not delete that task.');
    }
  }

  async function loadActivity(taskId: string) {
    setActivityLoading((current) => ({ ...current, [taskId]: true }));
    setActivityErrors((current) => ({ ...current, [taskId]: '' }));
    try {
      const { data } = await apiClient.get<TaskActivityItem[]>(`/tasks/${taskId}/activity`);
      setActivityByTask((current) => ({ ...current, [taskId]: data }));
    } catch {
      setActivityErrors((current) => ({ ...current, [taskId]: 'Could not load activity. Try again.' }));
    } finally {
      setActivityLoading((current) => ({ ...current, [taskId]: false }));
    }
  }

  function toggleActivity(taskId: string) {
    const opening = !expandedActivity[taskId];
    setExpandedActivity((current) => ({ ...current, [taskId]: opening }));
    if (opening && !Object.hasOwn(activityByTask, taskId)) void loadActivity(taskId);
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <section className="task-workspace">
      <div className="page-heading">
        <div><p className="eyebrow">Workspace</p><h1>Tasks</h1><p className="muted-copy">Read and complete assigned work, or manage tasks for your team.</p></div>
        <span className="role-pill">{user?.role}</span>
      </div>

      {canCreate && <form className="page-card task-create-form" onSubmit={createTask}>
        <h2>Create a task</h2>
        <p className="field-hint"><span className="required-marker" aria-hidden="true">*</span> Required field</p>
        <div className="form-row">
          <div><label htmlFor="task-title">Title <span className="required-marker" aria-hidden="true">*</span></label><input id="task-title" maxLength={160} minLength={1} onChange={(event) => setCreateTitle(event.target.value)} required value={createTitle} /></div>
          {canAssign && <div><label htmlFor="task-owner">Assign to</label><select id="task-owner" onChange={(event) => setCreateOwnerId(event.target.value)} value={createOwnerId}><option value="">Assign to me ({currentUserName})</option>{assignableUsers.map((person) => <option key={person.id} value={person.id}>{[person.firstName, person.lastName].filter(Boolean).join(' ') || person.email}</option>)}</select></div>}
        </div>
        <label htmlFor="task-description">Description</label>
        <textarea id="task-description" maxLength={4000} onChange={(event) => setCreateDescription(event.target.value)} rows={3} value={createDescription} />
        <button className="primary-button submit-button" disabled={creating} type="submit">{creating ? 'Creating…' : 'Create task'}</button>
      </form>}

      <form className="task-filters page-card" onSubmit={applyFilters}>
        <div><label htmlFor="task-search">Search</label><input id="task-search" onChange={(event) => setSearchInput(event.target.value)} placeholder="Search task titles or details" value={searchInput} /></div>
        <div><label htmlFor="task-status-filter">Status</label><select id="task-status-filter" onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} value={statusFilter}><option value="">All statuses</option><option value="PENDING">Pending</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option></select></div>
        <button className="quiet-button" type="submit">Search tasks</button>
      </form>

      {error && <p className="form-error task-error" role="alert">{error}</p>}
      {loading ? <div className="page-card" role="status">Loading tasks…</div> : result.items.length === 0 ? (
        <div className="page-card empty-state"><h2>No tasks found</h2><p>Try changing your search, or create a task if your role allows it.</p></div>
      ) : <div className="task-list">
        {result.items.map((task) => {
          const subjectForTask = taskSubject(task.userId, { id: task.id, createdById: task.createdById });
          const canEdit = ability.can('update', subjectForTask);
          const canComplete = ability.can('complete', subjectForTask) && task.status !== 'COMPLETED';
          const canDelete = ability.can('delete', subjectForTask);
          const canReadActivity = ability.can('read', subjectForTask);
          const assignedName = [task.user?.firstName, task.user?.lastName].filter(Boolean).join(' ') || task.user?.email;
          return <article className="task-card page-card" key={task.id}>
            {editingId === task.id ? (
              <form className="task-edit-form" onSubmit={saveEdit}>
                <p className="field-hint"><span className="required-marker" aria-hidden="true">*</span> Required field</p>
                <label htmlFor={`edit-title-${task.id}`}>Title <span className="required-marker" aria-hidden="true">*</span></label><input id={`edit-title-${task.id}`} maxLength={160} minLength={1} onChange={(event) => setEditTitle(event.target.value)} required value={editTitle} />
                <label htmlFor={`edit-description-${task.id}`}>Description</label><textarea id={`edit-description-${task.id}`} onChange={(event) => setEditDescription(event.target.value)} rows={3} value={editDescription} />
                <label htmlFor={`edit-status-${task.id}`}>Status</label><select id={`edit-status-${task.id}`} onChange={(event) => setEditStatus(event.target.value as TaskStatus)} value={editStatus}><option value="PENDING">Pending</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option></select>
                <div className="task-actions"><button className="primary-button" type="submit">Save</button><button className="quiet-button" onClick={() => setEditingId('')} type="button">Cancel</button></div>
              </form>
            ) : <>
              <div className="task-card-heading"><div><span className={`status-pill status-${task.status.toLowerCase()}`}>{task.status.replace('_', ' ')}</span><h2>{task.title}</h2></div>
                <div className="task-actions">
                  {canComplete && <button className="primary-button" onClick={() => void completeTask(task)} type="button">Mark complete</button>}
                  {canEdit && <button className="quiet-button" onClick={() => beginEdit(task)} type="button">Edit</button>}
                  {canDelete && <button className="quiet-button danger-button" onClick={() => void deleteTask(task)} type="button">Delete</button>}
                </div>
              </div>
              {task.description && <p className="muted-copy task-description">{task.description}</p>}
              <div className="task-meta"><span>{assignedName ? `Assigned to ${assignedName}` : 'Assigned task'}</span><span>Created {new Date(task.createdAt).toLocaleDateString()}</span></div>
              {canReadActivity && <>
                <button
                  aria-controls={`task-activity-${task.id}`}
                  aria-expanded={Boolean(expandedActivity[task.id])}
                  className="quiet-button task-activity-toggle"
                  onClick={() => toggleActivity(task.id)}
                  type="button"
                >
                  {expandedActivity[task.id] ? 'Hide activity' : 'View activity'}
                </button>
                {expandedActivity[task.id] && <section aria-label={`Activity for ${task.title}`} className="task-activity" id={`task-activity-${task.id}`}>
                  <h3>Task activity</h3>
                  {activityLoading[task.id] ? <p role="status">Loading activity…</p> : activityErrors[task.id] ? (
                    <div><p className="form-error" role="alert">{activityErrors[task.id]}</p><button className="quiet-button" onClick={() => void loadActivity(task.id)} type="button">Retry</button></div>
                  ) : activityByTask[task.id]?.length ? (
                    <ol className="task-activity-list">
                      {activityByTask[task.id].map((activity) => {
                        const actorName = [activity.actor?.firstName, activity.actor?.lastName].filter(Boolean).join(' ') || 'A team member';
                        return <li key={activity.id}>
                          <p><strong>{actorName}</strong> {activity.summary}</p>
                          <time dateTime={activity.createdAt}>{new Date(activity.createdAt).toLocaleString()}</time>
                        </li>;
                      })}
                    </ol>
                  ) : <p className="muted-copy">No activity recorded yet.</p>}
                </section>}
              </>}
            </>}
          </article>;
        })}
      </div>}

      {result.pageCount > 1 && <div className="pagination"><button className="quiet-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} type="button">Previous</button><span>Page {page} of {result.pageCount} · {result.total} tasks</span><button className="quiet-button" disabled={page >= result.pageCount} onClick={() => setPage((value) => value + 1)} type="button">Next</button></div>}
    </section>
  );
}
