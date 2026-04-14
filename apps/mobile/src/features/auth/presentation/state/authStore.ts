import { create } from 'zustand';

import type { User } from '@rtc/contracts';

import { logger } from '../../../../lib/logger';
import { syncEngine } from '../../../chat/data/SyncEngine';
import { authRepository } from '../../data/AuthRepository';

interface AuthState {
  user: User | null;
  status: 'idle' | 'loading' | 'authed' | 'error';
  error: string | null;
  bootstrap: () => Promise<void>;
  login: (handle: string, password: string) => Promise<void>;
  register: (handle: string, displayName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'loading',
  error: null,

  async bootstrap() {
    try {
      const tokens = await authRepository.loadTokens();
      if (!tokens) {
        set({ status: 'idle' });
        return;
      }

      // Restore cached user from KV — no network call, instant transition.
      const cachedUser = authRepository.restoreUser();
      if (!cachedUser) {
        // Tokens exist but no cached user (e.g. first launch after this update).
        // Clear stale tokens so the user logs in fresh and we cache the user.
        await authRepository.clearTokens();
        set({ status: 'idle' });
        return;
      }

      // Show chat screens immediately, connect socket in background.
      set({ user: cachedUser, status: 'authed' });

      // Pre-set userId on SyncEngine so enqueueSend works immediately,
      // even before the async socket connection completes.
      syncEngine.setCurrentUserId(cachedUser.id);

      // Socket + SyncEngine attach happens in the background.
      // If the access token is expired the first API call will trigger
      // the 401→refresh→retry interceptor automatically.
      authRepository.finishLogin(cachedUser).catch((err) => {
        logger.warn('auth.bootstrap', 'finishLogin failed', err);
      });
    } catch (err) {
      logger.warn('auth.bootstrap', 'unexpected error', err);
      set({ status: 'idle' });
    }
  },

  async login(handle, password) {
    set({ status: 'loading', error: null });
    try {
      const { user, tokens } = await authRepository.login(handle, password);
      await authRepository.saveTokens(tokens);
      await authRepository.finishLogin(user);
      set({ user, status: 'authed' });
    } catch (err) {
      set({ status: 'error', error: extractError(err) });
    }
  },

  async register(handle, displayName, password) {
    set({ status: 'loading', error: null });
    try {
      const { user, tokens } = await authRepository.register(handle, displayName, password);
      await authRepository.saveTokens(tokens);
      await authRepository.finishLogin(user);
      set({ user, status: 'authed' });
    } catch (err) {
      set({ status: 'error', error: extractError(err) });
    }
  },

  async logout() {
    await authRepository.logout();
    set({ user: null, status: 'idle' });
  },
}));

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Invalid handle or password.',
  handle_taken: 'That handle is already taken.',
  invalid_body: 'Please check your input.',
};

function extractError(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const axiosErr = err as { response?: { data?: { error?: string } } };
    if (axiosErr.response?.data?.error) {
      const code = axiosErr.response.data.error;
      return ERROR_MESSAGES[code] ?? code;
    }
    // Network error — no response from server
    if ('request' in axiosErr && !axiosErr.response) {
      return 'Could not connect. Check your internet.';
    }
  }
  return 'Something went wrong';
}
