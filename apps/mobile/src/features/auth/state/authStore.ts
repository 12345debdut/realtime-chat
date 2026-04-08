import { create } from 'zustand';

import type { User } from '@rtc/contracts';

import { http } from '../../../api/http';
import { secureStore } from '../../../api/secureStore';
import { connectSocket, disconnectSocket } from '../../../api/socket';
import { kv, KvKeys } from '../../../lib/kv';
import { logger } from '../../../lib/logger';
import { syncEngine } from '../../../sync/SyncEngine';

interface AuthState {
  user: User | null;
  status: 'idle' | 'loading' | 'authed' | 'error';
  error: string | null;
  bootstrap: () => Promise<void>;
  login: (handle: string, password: string) => Promise<void>;
  register: (handle: string, displayName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'idle',
  error: null,

  async bootstrap() {
    const tokens = await secureStore.load();
    if (!tokens) return;
    try {
      set({ status: 'loading' });
      const { data } = await http.get<User>('/me');
      await finishLogin(data);
      set({ user: data, status: 'authed' });
    } catch (err) {
      logger.warn('auth.bootstrap', err);
      set({ status: 'idle' });
    }
  },

  async login(handle, password) {
    set({ status: 'loading', error: null });
    try {
      const { data } = await http.post<{ user: User; tokens: AuthTokensLike }>('/auth/login', {
        handle,
        password,
      });
      await secureStore.save(data.tokens);
      await finishLogin(data.user);
      set({ user: data.user, status: 'authed' });
    } catch (err) {
      set({ status: 'error', error: extractError(err) });
    }
  },

  async register(handle, displayName, password) {
    set({ status: 'loading', error: null });
    try {
      const { data } = await http.post<{ user: User; tokens: AuthTokensLike }>('/auth/register', {
        handle,
        displayName,
        password,
      });
      await secureStore.save(data.tokens);
      await finishLogin(data.user);
      set({ user: data.user, status: 'authed' });
    } catch (err) {
      set({ status: 'error', error: extractError(err) });
    }
  },

  async logout() {
    syncEngine.detach();
    disconnectSocket();
    await secureStore.clear();
    kv.delete(KvKeys.CurrentUserId);
    set({ user: null, status: 'idle' });
    void get; // keep reference to silence unused-var when debugging
  },
}));

// ── helpers ──────────────────────────────────────────────────────────────
interface AuthTokensLike {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

async function finishLogin(user: User) {
  kv.setString(KvKeys.CurrentUserId, user.id);
  const socket = await connectSocket();
  syncEngine.attach(socket, user.id);
}

function extractError(err: unknown): string {
  if (typeof err === 'object' && err && 'message' in err) return String((err as Error).message);
  return 'Something went wrong';
}
