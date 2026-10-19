import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiClient } from '../../shared/api/client';
import { setAccessToken } from '../../shared/api/access-token';
import type { AuthResponse, AuthUser } from '../../shared/api/types';

type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

interface Credentials {
  email: string;
  password: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (credentials: Credentials) => Promise<void>;
  register: (credentials: Credentials) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (profile: Pick<AuthUser, 'firstName' | 'lastName' | 'avatarUrl'>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
let sessionRestore: Promise<AuthResponse | null> | null = null;

function restoreSession(): Promise<AuthResponse | null> {
  sessionRestore ??= apiClient
    .post<AuthResponse>('/auth/refresh')
    .then(({ data }) => data)
    .catch(() => null)
    .finally(() => {
      sessionRestore = null;
    });
  return sessionRestore;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('checking');

  const applyAuth = useCallback((auth: AuthResponse) => {
    setAccessToken(auth.accessToken);
    setUser(auth.user);
    setStatus('authenticated');
  }, []);

  const clearAuth = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    let active = true;
    void restoreSession().then((auth) => {
      if (!active) return;
      if (auth) applyAuth(auth);
      else clearAuth();
    });

    const onExpired = () => clearAuth();
    window.addEventListener('todo:session-expired', onExpired);
    return () => {
      active = false;
      window.removeEventListener('todo:session-expired', onExpired);
    };
  }, [applyAuth, clearAuth]);

  const login = useCallback(async (credentials: Credentials) => {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', credentials);
    applyAuth(data);
  }, [applyAuth]);

  const register = useCallback(async (credentials: Credentials) => {
    const { data } = await apiClient.post<AuthResponse>('/auth/register', credentials);
    applyAuth(data);
  }, [applyAuth]);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      clearAuth();
    }
  }, [clearAuth]);

  const updateProfile = useCallback((profile: Pick<AuthUser, 'firstName' | 'lastName' | 'avatarUrl'>) => {
    setUser((current) => current ? { ...current, ...profile } : current);
  }, []);

  const value = useMemo(
    () => ({ user, status, login, register, logout, updateProfile }),
    [user, status, login, register, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
