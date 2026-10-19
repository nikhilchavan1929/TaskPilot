import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';
import { getAccessToken, setAccessToken } from './access-token';

const baseURL = import.meta.env.VITE_API_BASE_URL?.trim() || '/api';

export const apiClient = axios.create({
  baseURL,
  timeout: 10_000,
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

const refreshClient = axios.create({
  baseURL,
  timeout: 10_000,
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

let refreshInFlight: Promise<string | null> | null = null;

function isAuthEndpoint(url: string | undefined): boolean {
  return Boolean(url && /\/auth\/(register|login|refresh|logout)(\?|$)/.test(url));
}

function tokenFromConfig(config: InternalAxiosRequestConfig): string | null {
  const authorization = config.headers.Authorization;
  return typeof authorization === 'string' && authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;
}

export function applyRefreshResult(requestToken: string | null, refreshedToken: string): string | null {
  const currentToken = getAccessToken();
  if (currentToken !== requestToken) return currentToken;
  setAccessToken(refreshedToken);
  return refreshedToken;
}

export function applyRefreshFailure(requestToken: string | null): string | null {
  const currentToken = getAccessToken();
  if (currentToken !== requestToken) return currentToken;
  if (!requestToken) return null;
  window.dispatchEvent(new CustomEvent('todo:session-expired', {
    detail: { accessToken: requestToken },
  }));
  setAccessToken(null);
  return null;
}

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (error.response?.status !== 401 || !config || config._retried || isAuthEndpoint(config.url)) {
      return Promise.reject(error);
    }

    config._retried = true;
    const requestToken = tokenFromConfig(config);
    refreshInFlight ??= refreshClient
      .post<{ accessToken: string }>('/auth/refresh')
      .then(({ data }) => {
        return applyRefreshResult(requestToken, data.accessToken);
      })
      .catch(() => applyRefreshFailure(requestToken))
      .finally(() => {
        refreshInFlight = null;
      });

    const token = await refreshInFlight;
    if (!token) return Promise.reject(error);
    config.headers.Authorization = `Bearer ${token}`;
    return apiClient.request(config);
  },
);

