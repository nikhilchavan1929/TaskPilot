import { useEffect, useState } from 'react';
import { useAbility } from '@casl/react';
import { Link, NavLink, Outlet } from 'react-router';
import { taskSubject, type TodoAbility } from '../../app/ability';
import { useAuth } from '../../features/auth/AuthContext';
import { apiClient } from '../api/client';
import type { NotificationResponse } from '../api/types';

function initials(firstName?: string | null, lastName?: string | null, email?: string): string {
  const value = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}` || email?.[0] || '?';
  return value.toUpperCase();
}

export function AppLayout() {
  const { user, status, logout } = useAuth();
  const ability = useAbility<TodoAbility>();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [notifications, setNotifications] = useState<NotificationResponse>({ items: [], unreadCount: 0 });
  const canReadTasks = Boolean(user && (ability.can('read', taskSubject(user.id)) || ability.can('read', taskSubject('', { createdById: user.id }))));
  const canReadUsers = ability.can('read', 'User');
  const canManageRoles = ability.can('manage', 'Role');

  async function signOut() {
    setLogoutError(false);
    try {
      await logout();
    } catch {
      setLogoutError(true);
    }
  }

  useEffect(() => {
    if (user) setLogoutError(false);
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    if (!user) {
      setNotifications({ items: [], unreadCount: 0 });
      return;
    }
    void apiClient.get<NotificationResponse>('/notifications')
      .then(({ data }) => { if (active) setNotifications(data); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [user?.id]);

  async function markNotificationRead(id: string) {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      setNotifications((current) => {
        const wasUnread = current.items.some((item) => item.id === id && !item.readAt);
        return {
          items: current.items.map((item) => item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item),
          unreadCount: wasUnread ? Math.max(0, current.unreadCount - 1) : current.unreadCount,
        };
      });
    } catch {
      // The notification stays unread if the API could not save the change.
    }
  }

  function toggleNotifications() {
    const opening = !notificationsOpen;
    setNotificationsOpen(opening);
    if (opening) {
      void apiClient.get<NotificationResponse>('/notifications')
        .then(({ data }) => setNotifications(data))
        .catch(() => undefined);
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="Todo Management home">
          <span className="brand-mark" aria-hidden="true">✓</span>
          <span>Todo Management</span>
        </Link>
        <div className="header-actions">
          {status === 'checking' ? <span className="session-label">Checking session…</span> : user ? (
            <>
              <div className="notification-wrap">
                <button
                  aria-expanded={notificationsOpen}
                  aria-label={notifications.unreadCount > 0 ? `Notifications, ${notifications.unreadCount} unread` : 'Notifications'}
                  className="icon-button notification-button"
                  onClick={toggleNotifications}
                  type="button"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
                  </svg>
                </button>
                {notifications.unreadCount > 0 && <span aria-hidden="true" className="notification-unread-star">★</span>}
                {notificationsOpen && (
                  <div className="notification-popover">
                    <strong>Notifications</strong>
                    {notifications.items.length === 0 ? <p className="notification-empty">You’re all caught up.</p> : (
                      <div className="notification-list">
                        {notifications.items.map((notification) => <button className={notification.readAt ? 'notification-item read' : 'notification-item'} key={notification.id} onClick={() => void markNotificationRead(notification.id)} type="button">
                          <span>{notification.title}</span><small>{notification.message}</small><time>{new Date(notification.createdAt).toLocaleString()}</time>
                        </button>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Link className="profile-link" to="/profile" aria-label="Open your profile">
                {user.avatarUrl ? <img className="avatar" src={user.avatarUrl} alt="" /> : (
                  <span className="avatar avatar-fallback">{initials(user.firstName, user.lastName, user.email)}</span>
                )}
                <span className="profile-name">{user.firstName || user.lastName ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : user.email}</span>
              </Link>
              <button className="quiet-button" onClick={() => void signOut()} type="button">Sign out</button>
            </>
          ) : <NavLink className="text-link" to="/login">Sign in</NavLink>}
          {logoutError && <p className="form-error" role="alert">
            You were signed out here, but the server could not end your session.{' '}
            <button className="text-link" onClick={() => void signOut()} type="button">Retry sign out</button>
          </p>}
        </div>
      </header>

      <div className="app-body">
        <aside className="side-menu" aria-label="Workspace menu">
          <p className="menu-label">Workspace</p>
          <nav className="side-nav">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'side-link active' : 'side-link'}>
              <span aria-hidden="true">⌂</span> Overview
            </NavLink>
            {canReadTasks && <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'side-link active' : 'side-link'}>
              <span aria-hidden="true">▦</span> Dashboard
            </NavLink>}
            {canReadTasks && <NavLink to="/tasks" className={({ isActive }) => isActive ? 'side-link active' : 'side-link'}>
              <span aria-hidden="true">☷</span> Tasks
            </NavLink>}
            {user && <NavLink to="/profile" className={({ isActive }) => isActive ? 'side-link active' : 'side-link'}>
              <span aria-hidden="true">◉</span> My profile
            </NavLink>}
            {user && canReadUsers && <NavLink to="/users" className={({ isActive }) => isActive ? 'side-link active' : 'side-link'}>
              <span aria-hidden="true">♙</span> Users
            </NavLink>}
            {user && canManageRoles && <NavLink to="/roles" className={({ isActive }) => isActive ? 'side-link active' : 'side-link'}>
              <span aria-hidden="true">⚙</span> Roles & access
            </NavLink>}
          </nav>
          {user && <div className="side-account">
            <span className="role-pill">{user.role}</span>
            <span className="side-account-email">{user.email}</span>
          </div>}
        </aside>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
      <footer className="site-footer">Todo Management · Role based workspace</footer>
    </div>
  );
}
