import { AbilityProvider } from '@casl/react';
import { useMemo, type ReactNode } from 'react';
import { createAbilityForUser } from '../../app/ability';
import { useAuth } from './AuthContext';

export function AuthAbilityProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const ability = useMemo(() => createAbilityForUser(user), [user]);
  return <AbilityProvider value={ability}>{children}</AbilityProvider>;
}
