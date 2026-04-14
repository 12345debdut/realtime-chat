/**
 * Auth token persistence via Keychain (iOS) / Keystore (Android).
 * Tokens must never land in MMKV or AsyncStorage.
 */
import * as Keychain from 'react-native-keychain';

import type { AuthTokens } from '@rtc/contracts';

const SERVICE = 'com.rtc.mobile.auth';

export const secureStore = {
  async save(tokens: AuthTokens): Promise<void> {
    await Keychain.setGenericPassword('tokens', JSON.stringify(tokens), {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
    });
  },

  async load(): Promise<AuthTokens | null> {
    const creds = await Keychain.getGenericPassword({ service: SERVICE });
    if (!creds) return null;
    try {
      return JSON.parse(creds.password) as AuthTokens;
    } catch {
      return null;
    }
  },

  async clear(): Promise<void> {
    await Keychain.resetGenericPassword({ service: SERVICE });
  },
};
