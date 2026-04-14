import type { AuthResponse, AuthTokens, User } from '@rtc/contracts';

import { http } from '../../../foundation/network/http';
import { secureStore } from '../../../foundation/network/secureStore';
import { connectSocket, disconnectSocket } from '../../../foundation/network/socket';
import { database } from '../../../foundation/storage';
import { kv, KvKeys } from '../../../foundation/storage/kv';
import { syncEngine } from '../../chat/data/SyncEngine';

export const authRepository = {
  async login(handle: string, password: string): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>('/auth/login', {
      handle,
      password,
    });
    return data;
  },

  async register(
    handle: string,
    displayName: string,
    password: string,
  ): Promise<AuthResponse> {
    const { data } = await http.post<AuthResponse>('/auth/register', {
      handle,
      displayName,
      password,
    });
    return data;
  },

  async getMe(): Promise<User> {
    const { data } = await http.get<User>('/me');
    return data;
  },

  async saveTokens(tokens: AuthTokens): Promise<void> {
    await secureStore.save(tokens);
  },

  async loadTokens() {
    return secureStore.load();
  },

  async clearTokens(): Promise<void> {
    await secureStore.clear();
  },

  async finishLogin(user: User): Promise<void> {
    const lastUserId = kv.getString(KvKeys.LastLoggedInUserId);
    if (lastUserId && lastUserId !== user.id) {
      // Different user — wipe previous user's data for privacy
      try {
        await database.write(() => database.unsafeResetDatabase());
      } catch {
        // best effort
      }
    }
    kv.setString(KvKeys.CurrentUserId, user.id);
    kv.setString(KvKeys.CurrentUser, JSON.stringify(user));
    kv.setString(KvKeys.LastLoggedInUserId, user.id);
    const socket = await connectSocket();
    syncEngine.attach(socket, user.id);
  },

  /** Restore the cached user from KV (no network call). */
  restoreUser(): User | null {
    const raw = kv.getString(KvKeys.CurrentUser);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    syncEngine.detach();
    disconnectSocket();
    // Preserve WatermelonDB data so the same user can re-login instantly.
    // Data is wiped in finishLogin() only when a different user logs in.
    const currentUserId = kv.getString(KvKeys.CurrentUserId);
    if (currentUserId) {
      kv.setString(KvKeys.LastLoggedInUserId, currentUserId);
    }
    kv.delete(KvKeys.CurrentUserId);
    kv.delete(KvKeys.CurrentUser);
    await secureStore.clear();
  },
};
