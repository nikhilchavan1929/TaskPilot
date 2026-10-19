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
    refreshInFlight ??= refreshClient
      .post<{ accessToken: string }>('/auth/refresh')
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        return data.accessToken;
      })
      .catch(() => {
        setAccessToken(null);
        window.dispatchEvent(new Event('todo:session-expired'));
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });

    const token = await refreshInFlight;
    if (!token) return Promise.reject(error);
    config.headers.Authorization = `Bearer ${token}`;
    return apiClient.request(config);
  },
);

