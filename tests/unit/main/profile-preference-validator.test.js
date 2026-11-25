import { describe, expect, it } from 'vitest';
import {
  MAX_BACKUP_AGE,
  MAX_BACKUP_COUNT,
  MAX_BACKUP_INTERVAL,
  MIN_BACKUP_AGE,
  MIN_BACKUP_COUNT,
  MIN_BACKUP_INTERVAL,
  validateBackupSettings,
  validateProfilePreferences
} from '../../../src/main/modules/profile-preference-validator.js';

describe('profile preference validation', () => {
  it('accepts the supported backup policy limits and preserves unrelated preferences', () => {
    const preferences = {
      screen_mode: 'dark',
      backup_settings: {
        autoBackupEnabled: false,
        backupInterval: MIN_BACKUP_INTERVAL,
        maxBackupCount: MAX_BACKUP_COUNT,
        maxBackupAge: MAX_BACKUP_AGE
      }
    };

    expect(validateProfilePreferences(preferences)).toEqual({
      valid: true,
      error: undefined,
      value: preferences
    });
    expect(validateBackupSettings({
      backupInterval: MAX_BACKUP_INTERVAL,
      maxBackupCount: MIN_BACKUP_COUNT,
      maxBackupAge: MIN_BACKUP_AGE
    }).valid).toBe(true);
    expect(validateBackupSettings({ maxBackupAge: 0 }).valid).toBe(true);
  });

  it.each([
    ['string interval', { backupInterval: '900000' }],
    ['tiny interval', { backupInterval: MIN_BACKUP_INTERVAL - 1 }],
    ['non-finite interval', { backupInterval: Infinity }],
    ['negative count', { maxBackupCount: -1 }],
    ['fractional count', { maxBackupCount: 1.5 }],
    ['negative age', { maxBackupAge: -1 }],
    ['oversized age', { maxBackupAge: MAX_BACKUP_AGE + 1 }],
    ['string boolean', { autoBackupEnabled: 'false' }],
    ['unknown alias', { maxCount: 1 }]
  ])('rejects %s', (_label, settings) => {
    expect(validateBackupSettings(settings).valid).toBe(false);
  });

  it('fills missing fields for older partial settings without changing valid values', () => {
    const result = validateBackupSettings({ autoBackupEnabled: false, maxBackupCount: 3 });

    expect(result.valid).toBe(true);
    expect(result.value).toMatchObject({
      autoBackupEnabled: false,
      backupInterval: 30 * 60 * 1000,
      maxBackupCount: 3,
      maxBackupAge: 30 * 24 * 60 * 60 * 1000
    });
  });
});
