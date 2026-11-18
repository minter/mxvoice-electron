import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userDataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mxvoice-unusable-folder-'));

vi.mock('electron', () => ({
  default: { app: { getPath: () => userDataDirectory } }
}));

const profilePaths = await import('../../../src/main/modules/profile-paths.js');
const profiles = await import('../../../src/main/modules/profile-manager.js');
const backups = await import('../../../src/main/modules/profile-backup-manager.js');
const { createShowStore, ShowStoreError } = await import('../../../src/main/modules/show-store.js');

const profilesDirectory = path.join(userDataDirectory, 'profiles');
const FOLDER_MESSAGE = 'Profile name has no usable folder name';
const DELETE_MESSAGE =
  "This profile's name can't be used for a folder, so Mx. Voice can't delete it safely. Rename it in a newer version or contact support.";
const debugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

function seedRegistry(names) {
  const registry = { profiles: {} };
  for (const name of ['Default User', ...names]) {
    registry.profiles[name] = { name, description: '', created_at: 1, last_used: 1 };
  }
  fs.writeFileSync(path.join(userDataDirectory, 'profiles.json'), JSON.stringify(registry));
}

beforeAll(async () => {
  profiles.initializeProfileManager({ debugLog });
  await backups.initializeProfileBackupManager({ debugLog });
});

afterAll(() => fs.rmSync(userDataDirectory, { recursive: true, force: true }));

describe.each(['日本語', '🎭', '!!!'])('legacy profile named %s', (name) => {
  beforeEach(() => {
    fs.rmSync(profilesDirectory, { recursive: true, force: true });
    fs.mkdirSync(path.join(profilesDirectory, 'Default User'), { recursive: true });
    fs.writeFileSync(path.join(profilesDirectory, 'Default User', 'keep.txt'), 'x');
    seedRegistry([name]);
  });

  it('getProfileDirectory throws', () => {
    expect(profilePaths.hasUsableDirectoryKey(name)).toBe(false);
    expect(() => profilePaths.getProfileDirectory(name)).toThrow(FOLDER_MESSAGE);
    expect(() => profilePaths.getRecoveryPath(name)).toThrow(FOLDER_MESSAGE);
    expect(() => profilePaths.getBackupDirectory(name)).toThrow(FOLDER_MESSAGE);
    expect(() => profilePaths.getProfileShowsPath(name)).toThrow(FOLDER_MESSAGE);
  });

  it('delete is blocked with the message', () => {
    expect(profiles.getDeleteProfileBlocker(name)).toBe(DELETE_MESSAGE);
    expect(profiles.deleteProfile(name)).toEqual({ success: false, error: DELETE_MESSAGE });
    expect(fs.existsSync(path.join(profilesDirectory, 'Default User', 'keep.txt'))).toBe(true);
  });

  it('deleteProfile never removes the profiles folder even if the blocker is bypassed', () => {
    // The old path helper resolved this name to the shared profiles folder
    expect(path.resolve(path.join(profilesDirectory, profilePaths.sanitizeProfileName(name)))).toBe(
      path.resolve(profilesDirectory)
    );
    // Even a caller that skips the blocker cannot reach rmSync with that folder
    const rmSync = vi.spyOn(fs, 'rmSync');
    expect(() => profilePaths.getProfileDirectory(name)).toThrow(FOLDER_MESSAGE);
    expect(profiles.deleteProfile(name).success).toBe(false);
    expect(rmSync).not.toHaveBeenCalled();
    rmSync.mockRestore();
    expect(fs.existsSync(profilesDirectory)).toBe(true);
    expect(fs.existsSync(path.join(profilesDirectory, 'Default User', 'keep.txt'))).toBe(true);
  });

  it('backup and restore refuse', async () => {
    const created = await backups.createBackup(name);
    expect(created).toEqual({ success: false, error: FOLDER_MESSAGE });
    const backupId = 'backup-2001-01-01T00-00-00-000Z';
    await expect(backups.restoreBackup(name, backupId)).resolves.toMatchObject({ success: false });
    await expect(backups.checkBackupRestorable(name, backupId)).resolves.toEqual({
      success: false, error: FOLDER_MESSAGE
    });
    expect(fs.readdirSync(path.join(userDataDirectory, 'profile-backups'))).toEqual([]);
  });

  it('duplicate refuses', async () => {
    const result = await profiles.duplicateProfile(name, 'Copy', '');
    expect(result).toEqual({ success: false, error: FOLDER_MESSAGE });
    expect(fs.existsSync(path.join(profilesDirectory, 'Copy'))).toBe(false);
  });

  it('show-store never writes profiles/shows.json', async () => {
    const store = createShowStore({
      fs,
      getProfileShowsPath: profilePaths.getProfileShowsPath,
      getProfileStatePath: profilePaths.getProfileStatePath,
      getProfileDirectoryKey: profilePaths.getProfileDirectoryKey,
      hasUsableDirectoryKey: profilePaths.hasUsableDirectoryKey,
      profileExists: async (n) => profiles.profileExists(n),
      debugLog
    });
    await expect(store.load(name)).rejects.toMatchObject({ code: 'unreadable' });
    await expect(store.peek(name)).resolves.toBeNull();
    const { doc } = await store.resetUnreadable(name);
    expect(doc.shows).toHaveLength(1);
    await expect(store.save(name, doc)).rejects.toBeInstanceOf(ShowStoreError);
    expect(fs.existsSync(path.join(profilesDirectory, 'shows.json'))).toBe(false);
    expect(fs.readdirSync(profilesDirectory)).toEqual(['Default User']);
  });
});
