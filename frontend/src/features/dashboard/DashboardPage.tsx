import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { apiClient } from '../../shared/api/client';
import type { TaskDashboardSummary, TaskStatus } from '../../shared/api/types';
import { useAuth } from '../auth/AuthContext';

const emptyCounts: Record<TaskStatus, number> = {
  PENDING: 0,
  IN_PROGRESS: 0,
  COMPLETED: 0,
};

const statusLabels: Record<TaskStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
};

function displayName(firstName?: string | null, email?: string): string {
  return firstName?.trim() || email?.split('@')[0] || 'there';
}

export function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<TaskDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get<TaskDashboardSummary>('/tasks/summary');
      setSummary(data);
    } catch {
      setError('Could not load your task overview. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadSummary(); }, [loadSummary]);

  const counts = summary?.counts ?? emptyCounts;
  const completionPercent = summary?.total
    ? Math.round((counts.COMPLETED / summary.total) * 100)
    : 0;

  return (
    <section className="dashboard-page">
      <div className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">Workspace overview</p>
          <h1>Hello, {displayName(user?.firstName, user?.email)}.</h1>
          <p className="muted-copy">Here’s the latest view of the tasks you can access.</p>
        </div>
        <Link className="primary-button" to="/tasks">Open tasks</Link>
      </div>

      {error && <div className="dashboard-error" role="alert"><span>{error}</span><button className="quiet-button" onClick={() => void loadSummary()} type="button">Retry</button></div>}

      <div aria-label="Task totals" className="dashboard-metrics">
        <article className="page-card metric-card"><span>Total tasks</span><strong>{loading ? '—' : summary?.total ?? 0}</strong><small>Tasks visible to your account</small></article>
        <article className="page-card metric-card metric-pending"><span>Pending</span><strong>{loading ? '—' : counts.PENDING}</strong><small>Waiting to be started</small></article>
        <article className="page-card metric-card metric-progress"><span>In progress</span><strong>{loading ? '—' : counts.IN_PROGRESS}</strong><small>Currently being worked on</small></article>
        <article className="page-card metric-card metric-completed"><span>Completed</span><strong>{loading ? '—' : counts.COMPLETED}</strong><small>{completionPercent}% of visible tasks</small></article>
      </div>

      <div className="dashboard-lower-grid">
        <section className="page-card dashboard-recent" aria-labelledby="recent-tasks-heading">
          <div className="dashboard-section-heading"><div><p className="eyebrow">Latest updates</p><h2 id="recent-tasks-heading">Recent tasks</h2></div><Link className="text-link" to="/tasks">View all</Link></div>
          {loading ? <p className="dashboard-empty" role="status">Loading recent tasks…</p> : summary?.recentTasks.length ? (
            <ul className="dashboard-task-list">
              {summary.recentTasks.map((task) => (
                <li key={task.id}>
                  <div className="dashboard-task-copy"><strong>{task.title}</strong><span>Updated {new Date(task.updatedAt).toLocaleDateString()}</span></div>
                  <span className={`status-pill status-${task.status.toLowerCase()}`}>{statusLabels[task.status]}</span>
                </li>
              ))}
            </ul>
          ) : <div className="dashboard-empty"><p>No tasks yet.</p><Link className="text-link" to="/tasks">Go to your task list</Link></div>}
        </section>

        <section className="page-card dashboard-progress" aria-labelledby="completion-heading">
          <p className="eyebrow">Progress</p>
          <h2 id="completion-heading">Completion rate</h2>
          <div aria-label={`${completionPercent}% of tasks completed`} className="progress-track" role="img"><span style={{ width: `${completionPercent}%` }} /></div>
          <p className="muted-copy">{loading ? 'Calculating progress…' : `${counts.COMPLETED} of ${summary?.total ?? 0} visible tasks completed.`}</p>
          <Link className="text-link" to="/tasks">Review your tasks</Link>
        </section>
      </div>
    </section>
  );
}