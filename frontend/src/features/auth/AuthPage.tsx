import { useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useAuth } from './AuthContext';
import { createAbilityForUser, taskSubject } from '../../app/ability';
import type { AuthUser } from '../../shared/api/types';

interface AuthPageProps {
  mode: 'login' | 'register';
}

interface RedirectState {
  from?: { pathname?: string; search?: string; hash?: string };
}

export function messageFromError(error: unknown): string {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const payload = error.response?.data as { message?: unknown } | undefined;
    if (Array.isArray(payload?.message)) {
      const messages = payload.message.filter((message): message is string => typeof message === 'string');
      if (messages.length > 0) return messages.join(' ');
    }
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message;
    if (status === 409) return 'An account with this email already exists.';
    if (status === 401) return 'The email or password is incorrect.';
    if (status === 503) return 'Authentication is temporarily unavailable. Try again later.';
    if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
    if (status && status >= 400 && status < 500) return `The request could not be completed (${status}). Check the details and try again.`;
  }
  return 'Could not connect to the service. Check that the API is running and try again.';
}

export function destinationForUser(user: AuthUser | null, intended?: RedirectState['from']) {
  const ability = createAbilityForUser(user);
  const canReadTasks = Boolean(user && (
    ability.can('read', taskSubject(user.id)) ||
    ability.can('read', taskSubject('', { createdById: user.id }))
  ));
  const fallback = canReadTasks ? '/dashboard' : '/profile';
  if (!intended?.pathname) return fallback;
  if (!canReadTasks && ['/tasks', '/dashboard'].includes(intended.pathname)) return '/profile';
  return { pathname: intended.pathname, search: intended.search ?? '', hash: intended.hash ?? '' };
}

export function AuthPage({ mode }: AuthPageProps) {
  const { user, status, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isRegister = mode === 'register';
  const from = (location.state as RedirectState | null)?.from;
  const destination = destinationForUser(user, from);

  if (status === 'checking') {
    return <div className="page-card loading-card" role="status">Checking your session…</div>;
  }
  if (status === 'authenticated') return <Navigate to={destination} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setSubmitting(true);
    try {
      const credentials = { email: email.trim(), password };
      const authenticatedUser = isRegister ? await register(credentials) : await login(credentials);
      if (!authenticatedUser) return;
      await navigate(destinationForUser(authenticatedUser, from), { replace: true });
    } catch (error) {
      setErrorMessage(messageFromError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-card page-card" aria-labelledby="auth-heading">
      <p className="eyebrow">Todo workspace</p>
      <h1 id="auth-heading">{isRegister ? 'Create your account' : 'Welcome back'}</h1>
      <p className="muted-copy">
        {isRegister ? 'Create an account to organize your tasks.' : 'Sign in to continue to your tasks.'}
      </p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <p className="field-hint"><span className="required-marker" aria-hidden="true">*</span> Required field</p>
        <label htmlFor="email">Email <span className="required-marker" aria-hidden="true">*</span></label>
        <input
          autoComplete="email"
          id="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
        <label htmlFor="password">Password <span className="required-marker" aria-hidden="true">*</span></label>
        <input
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          id="password"
          maxLength={72}
          minLength={isRegister ? 12 : undefined}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        {isRegister && <p className="field-hint">Use at least 12 characters.</p>}
        {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
        <button className="primary-button submit-button" disabled={submitting} type="submit">
          {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
        </button>
      </form>
      <p className="auth-switch">
        {isRegister ? 'Already registered?' : 'New to Todo Management?'}{' '}
        <Link className="text-link" to={isRegister ? '/login' : '/register'}>
          {isRegister ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
    </section>
  );
}
