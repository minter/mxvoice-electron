import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userDataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mxvoice-profile-failures-'));

vi.mock('electron', () => ({
  default: { app: { getPath: () => userDataDirectory } }
}));

const profiles = await import('../../../src/main/modules/profile-manager.js');
const profileDirectory = (name) => path.join(userDataDirectory, 'profiles', name);

beforeAll(() => {
  profiles.initializeProfileManager({
    debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  });
});

afterAll(() => fs.rmSync(userDataDirectory, { recursive: true, force: true }));

describe('profile manager failure recovery', () => {
  it('falls back to the default registry when profiles.json is corrupt', () => {
    fs.writeFileSync(path.join(userDataDirectory, 'profiles.json'), '{broken json');
    expect(profiles.getAvailableProfiles()).toEqual([
      expect.objectContaining({ name: 'Default User' })
    ]);
  });

  it('returns null rather than leaking a parse error for corrupt preferences', async () => {
    fs.mkdirSync(profileDirectory('Broken'), { recursive: true });
    fs.writeFileSync(path.join(profileDirectory('Broken'), 'preferences.json'), '{broken json');
    await expect(profiles.loadProfilePreferences('Broken')).resolves.toBeNull();
  });

  it('recursively unwraps accidentally persisted IPC response objects', async () => {
    fs.mkdirSync(profileDirectory('Wrapped'), { recursive: true });
    fs.writeFileSync(path.join(profileDirectory('Wrapped'), 'preferences.json'), JSON.stringify({
      font_size: { success: true, value: { success: true, value: 14 } }
    }));
    await expect(profiles.loadProfilePreferences('Wrapped')).resolves.toMatchObject({ font_size: 14 });
  });

  it('removes a partially copied target directory when duplication fails', async () => {
    fs.writeFileSync(path.join(userDataDirectory, 'profiles.json'), JSON.stringify({
      profiles: { Source: { name: 'Source' } }, metadata: { version: '1.0.0' }
    }));
    fs.mkdirSync(profileDirectory('Source'), { recursive: true });
    fs.writeFileSync(path.join(profileDirectory('Source'), 'preferences.json'), '{}');
    const copyFailure = vi.spyOn(fs, 'copyFile').mockImplementation((_src, _dest, callback) => {
      callback(new Error('copy interrupted'));
    });

    await expect(profiles.duplicateProfile('Source', 'Target')).resolves.toEqual({
      success: false, error: 'copy interrupted'
    });
    expect(fs.existsSync(profileDirectory('Target'))).toBe(false);
    copyFailure.mockRestore();
  });
});
