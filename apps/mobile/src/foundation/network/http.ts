/**
 * REST client with auth refresh interceptor.
 * - Attaches access token on every request.
 * - On 401, attempts refresh exactly once; queues concurrent requests so they
 *   all use the new access token instead of each firing their own refresh.
 */
import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

import type { AuthTokens } from '@rtc/contracts';

import { logger } from '../../lib/logger';

import { API_URL } from './config';
import { secureStore } from './secureStore';

export const http = axios.create({ baseURL: API_URL, timeout: 30_000 });

let refreshPromise: Promise<AuthTokens | null> | null = null;

async function refresh(): Promise<AuthTokens | null> {
  const current = await secureStore.load();
  if (!current) return null;
  try {
    const res = await axios.post<AuthTokens>(`${API_URL}/auth/refresh`, {
      refreshToken: current.refreshToken,
    }, { timeout: 15_000 });
    await secureStore.save(res.data);
    return res.data;
  } catch (err) {
    logger.warn('http.refresh', err);
    await secureStore.clear();
    // Trigger logout so the UI navigates back to Login screen
    const { useAuthStore } = require('../../features/auth/presentation/state/authStore');
    useAuthStore.getState().logout();
    return null;
  }
}

http.interceptors.request.use(async (config) => {
  const tokens = await secureStore.load();
  if (tokens?.accessToken) {
    config.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  }
  return config;
});

http.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      refreshPromise ??= refresh().finally(() => {
        refreshPromise = null;
      });
      const next = await refreshPromise;
      if (next) {
        original.headers = { ...original.headers, Authorization: `Bearer ${next.accessToken}` };
        return http(original);
      }
    }
    return Promise.reject(error);
  },
);
