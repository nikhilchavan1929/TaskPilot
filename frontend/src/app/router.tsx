import { createBrowserRouter } from 'react-router';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { TasksPage } from '../features/tasks/TasksPage';
import { AppLayout } from '../shared/layout/AppLayout';
import { AuthPage } from '../features/auth/AuthPage';
import { PermissionRoute, ProtectedRoute } from '../features/auth/ProtectedRoute';
import { ProfilePage } from '../features/profile/ProfilePage';
import { UsersPage } from '../features/users/UsersPage';
import { RolesPage } from '../features/roles/RolesPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { taskSubject } from './ability';
import { useAuth } from '../features/auth/AuthContext';

function ProtectedTasksPage() {
  const { user } = useAuth();
  return user ? <PermissionRoute check={(ability) =>
    ability.can('read', taskSubject(user.id)) ||
    ability.can('read', taskSubject('', { createdById: user.id }))
  }><TasksPage /></PermissionRoute> : null;
}

function ProtectedDashboardPage() {
  const { user } = useAuth();
  return user ? <PermissionRoute check={(ability) =>
    ability.can('read', taskSubject(user.id)) ||
    ability.can('read', taskSubject('', { createdById: user.id }))
  }><DashboardPage /></PermissionRoute> : null;
}

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <AuthPage mode="login" /> },
      { path: 'register', element: <AuthPage mode="register" /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'tasks', element: <ProtectedTasksPage /> },
          { path: 'dashboard', element: <ProtectedDashboardPage /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'users', element: <PermissionRoute check={(ability) => ability.can('read', 'User')}><UsersPage /></PermissionRoute> },
          { path: 'roles', element: <PermissionRoute check={(ability) => ability.can('manage', 'Role')}><RolesPage /></PermissionRoute> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
