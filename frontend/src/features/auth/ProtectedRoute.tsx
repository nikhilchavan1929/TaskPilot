import { Navigate, Outlet, useLocation } from 'react-router';
import { useAbility } from '@casl/react';
import type { ReactNode } from 'react';
import type { TodoAbility } from '../../app/ability';
import { useAuth } from './AuthContext';

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'checking') {
    return <div className="page-card loading-card" role="status">Restoring your session…</div>;
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

export function PermissionRoute({ check, children }: { check: (ability: TodoAbility) => boolean; children: ReactNode }) {
  const ability = useAbility<TodoAbility>();
  return check(ability) ? children : <Navigate to="/" replace />;
}
