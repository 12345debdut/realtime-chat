import { create } from 'zustand';

import type { PrivacySettings } from '@rtc/contracts';

import { logger } from '../../../../lib/logger';
import { privacyRepository } from '../../data/PrivacyRepository';

interface PrivacyState {
  // Server-synced
  readReceiptsEnabled: boolean;
  onlineStatusVisible: boolean;
  typingIndicatorsEnabled: boolean;
  // Device-local
  biometricLock: boolean;
  screenSecurity: boolean;
  // Loading state
  updating: boolean;

  hydrate: () => void;
  updateServer: (changes: Partial<PrivacySettings>) => Promise<void>;
  setBiometricLock: (value: boolean) => void;
  setScreenSecurity: (value: boolean) => void;
}

export const usePrivacyStore = create<PrivacyState>((set, get) => ({
  readReceiptsEnabled: true,
  onlineStatusVisible: true,
  typingIndicatorsEnabled: true,
  biometricLock: false,
  screenSecurity: false,
  updating: false,

  hydrate() {
    const cached = privacyRepository.getCached();
    set({
      ...cached,
      biometricLock: privacyRepository.getBiometricLock(),
      screenSecurity: privacyRepository.getScreenSecurity(),
    });
  },

  async updateServer(changes) {
    // Optimistic update
    const prev = {
      readReceiptsEnabled: get().readReceiptsEnabled,
      onlineStatusVisible: get().onlineStatusVisible,
      typingIndicatorsEnabled: get().typingIndicatorsEnabled,
    };
    set({ ...changes, updating: true });

    try {
      const result = await privacyRepository.update(changes);
      set({ ...result, updating: false });
    } catch (err) {
      logger.error('privacyStore', 'updateServer failed, rolling back', err);
      // Rollback
      set({ ...prev, updating: false });
      throw err;
    }
  },

  setBiometricLock(value) {
    privacyRepository.setBiometricLock(value);
    set({ biometricLock: value });
  },

  setScreenSecurity(value) {
    privacyRepository.setScreenSecurity(value);
    set({ screenSecurity: value });
  },
}));
