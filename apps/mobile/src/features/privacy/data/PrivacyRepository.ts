import type { PrivacySettings, PrivacySettingsUpdate } from '@rtc/contracts';

import { http } from '../../../foundation/network/http';
import { kv, KvKeys } from '../../../foundation/storage/kv';

export const privacyRepository = {
  /** Update server-synced privacy settings via PATCH /me/privacy */
  async update(changes: PrivacySettingsUpdate): Promise<PrivacySettings> {
    const { data } = await http.patch<PrivacySettings>('/me/privacy', changes);
    // Cache locally
    this.cacheSettings(data);
    return data;
  },

  /** Cache server-synced privacy settings to MMKV */
  cacheSettings(settings: PrivacySettings): void {
    kv.setBoolean(KvKeys.PrivacyReadReceipts, settings.readReceiptsEnabled);
    kv.setBoolean(KvKeys.PrivacyOnlineStatus, settings.onlineStatusVisible);
    kv.setBoolean(
      KvKeys.PrivacyTypingIndicators,
      settings.typingIndicatorsEnabled,
    );
  },

  /** Read cached server-synced settings (defaults to true if not cached) */
  getCached(): PrivacySettings {
    return {
      readReceiptsEnabled:
        kv.getBoolean(KvKeys.PrivacyReadReceipts) ?? true,
      onlineStatusVisible:
        kv.getBoolean(KvKeys.PrivacyOnlineStatus) ?? true,
      typingIndicatorsEnabled:
        kv.getBoolean(KvKeys.PrivacyTypingIndicators) ?? true,
    };
  },

  // Device-local settings
  getBiometricLock(): boolean {
    return kv.getBoolean(KvKeys.PrivacyBiometricLock) ?? false;
  },
  setBiometricLock(value: boolean): void {
    kv.setBoolean(KvKeys.PrivacyBiometricLock, value);
  },
  getScreenSecurity(): boolean {
    return kv.getBoolean(KvKeys.PrivacyScreenSecurity) ?? false;
  },
  setScreenSecurity(value: boolean): void {
    kv.setBoolean(KvKeys.PrivacyScreenSecurity, value);
  },
};
