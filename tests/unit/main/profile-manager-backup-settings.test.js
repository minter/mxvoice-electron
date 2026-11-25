import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userDataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mxvoice-profile-settings-'));

vi.mock('electron', () => ({
  default: { app: { getPath: () => userDataDirectory } }
}));

const profileManager = await import('../../../src/main/modules/profile-manager.js');
const profileName = 'Imported Profile';
const profileDirectory = path.join(userDataDirectory, 'profiles', profileName);
const preferencesPath = path.join(profileDirectory, 'preferences.json');

beforeAll(() => {
  fs.mkdirSync(profileDirectory, { recursive: true });
  profileManager.initializeProfileManager({
    debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  });
});

afterAll(() => {
  fs.rmSync(userDataDirectory, { recursive: true, force: true });
});

describe('profile backup settings boundary', () => {
  it('loads unsafe disk settings with safe defaults while preserving disabled backups', async () => {
    fs.writeFileSync(preferencesPath, JSON.stringify({
      screen_mode: 'dark',
      backup_settings: {
        autoBackupEnabled: false,
        backupInterval: 1,
        maxBackupCount: -1,
        maxBackupAge: 'forever'
      }
    }));

    const preferences = await profileManager.loadProfilePreferences(profileName);

    expect(preferences.screen_mode).toBe('dark');
    expect(preferences.backup_settings).toEqual({
      autoBackupEnabled: false,
      backupInterval: 30 * 60 * 1000,
      maxBackupCount: 25,
      maxBackupAge: 30 * 24 * 60 * 60 * 1000
    });
  });

  it('refuses to persist unsafe backup settings', async () => {
    const original = fs.readFileSync(preferencesPath, 'utf8');

    await expect(profileManager.saveProfilePreferences(profileName, {
      backup_settings: {
        autoBackupEnabled: true,
        backupInterval: 1,
        maxBackupCount: 25,
        maxBackupAge: 30 * 24 * 60 * 60 * 1000
      }
    })).resolves.toBe(false);

    expect(fs.readFileSync(preferencesPath, 'utf8')).toBe(original);
  });
});
