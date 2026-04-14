/**
 * MMKV-backed key-value store for small, hot values (settings, flags, lastSyncedAt).
 * 30× faster than AsyncStorage. Do NOT put secrets here — use Keychain instead.
 */
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'rtc-kv' });

export const kv = {
  getString(key: string): string | undefined {
    return storage.getString(key);
  },
  setString(key: string, value: string) {
    storage.set(key, value);
  },
  getNumber(key: string): number | undefined {
    return storage.getNumber(key);
  },
  setNumber(key: string, value: number) {
    storage.set(key, value);
  },
  getBoolean(key: string): boolean | undefined {
    return storage.getBoolean(key);
  },
  setBoolean(key: string, value: boolean) {
    storage.set(key, value);
  },
  delete(key: string) {
    storage.delete(key);
  },
} as const;

export const KvKeys = {
  LastSyncedAt: 'sync.lastSyncedAt',
  CurrentUserId: 'auth.currentUserId',
  CurrentUser: 'auth.currentUser',
  LastLoggedInUserId: 'auth.lastLoggedInUserId',
} as const;
