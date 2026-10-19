import { Link } from 'react-router';
import { HealthPanel } from '../features/health/HealthPanel';
import { useAuth } from '../features/auth/AuthContext';

export function HomePage() {
  const { user, status } = useAuth();
  return (
    <section className="welcome-grid">
      <div className="page-card welcome-card">
        <p className="eyebrow">Todo workspace</p>
        <h1>Keep your work moving.</h1>
        <p className="muted-copy">
          {user ? 'Your account is ready. Continue to your personal task workspace.' : 'Sign in or create an account to access your personal task workspace.'}
        </p>
        <div className="welcome-actions">
          <Link className="primary-button" to={user ? '/tasks' : '/login'}>{user ? 'Open tasks' : 'Sign in to continue'}</Link>
          {!user && status !== 'checking' && <Link className="text-link" to="/register">Create account</Link>}
          <HealthPanel />
        </div>
      </div>
      <aside className="page-card next-card">
        <p className="eyebrow">Foundation</p>
        <h2>Workspace access</h2>
        <ul>
          <li>Access token kept in memory</li>
          <li>HttpOnly refresh cookie session</li>
          <li>Role aware CASL interface</li>
        </ul>
      </aside>
    </section>
  );
}
