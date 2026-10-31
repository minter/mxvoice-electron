import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userDataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mxvoice-backup-manager-'));

vi.mock('electron', () => ({
  default: { app: { getPath: () => userDataDirectory } }
}));

const manager = await import('../../../src/main/modules/profile-backup-manager.js');
const profileName = 'Saturday: Show!';
const profileDirectory = path.join(userDataDirectory, 'profiles', 'Saturday Show');

beforeAll(async () => {
  await fs.promises.mkdir(profileDirectory, { recursive: true });
  await fs.promises.writeFile(path.join(profileDirectory, 'preferences.json'), '{"volume":80}');
  await fs.promises.writeFile(path.join(profileDirectory, 'state.json'), '{"tab":1}');
  await manager.initializeProfileBackupManager({
    debugLog: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }
  });
});

afterAll(async () => {
  await fs.promises.rm(userDataDirectory, { recursive: true, force: true });
});

describe('profile backup manager orchestration', () => {
  it('creates, lists, and deletes a real profile backup', async () => {
    const created = await manager.createBackup(profileName, { mode: 'manual' });
    expect(created.success).toBe(true);

    const listed = await manager.listBackups(profileName);
    expect(listed.backups).toEqual([
      expect.objectContaining({ id: created.backupId, mode: 'manual', fileCount: 2 })
    ]);

    const backupFile = path.join(manager.getBackupDirectory(profileName), created.backupId, 'state.json');
    await expect(fs.promises.readFile(backupFile, 'utf8')).resolves.toBe('{"tab":1}');

    await expect(manager.deleteBackup(profileName, created.backupId)).resolves.toEqual({ success: true });
    await expect(manager.listBackups(profileName)).resolves.toMatchObject({ success: true, backups: [] });
  });

  it('restores files and preserves the replaced state as a pre-restore backup', async () => {
    await fs.promises.writeFile(path.join(profileDirectory, 'state.json'), '{"tab":2}');
    const created = await manager.createBackup(profileName);
    await fs.promises.writeFile(path.join(profileDirectory, 'state.json'), '{"tab":99}');

    await expect(manager.restoreBackup(profileName, created.backupId)).resolves.toEqual({ success: true });
    await expect(fs.promises.readFile(path.join(profileDirectory, 'state.json'), 'utf8')).resolves.toBe('{"tab":2}');

    const listed = await manager.listBackups(profileName);
    expect(listed.backups.some((backup) => backup.mode === 'pre-restore')).toBe(true);
  });

  it('reports missing profiles and backup IDs without throwing', async () => {
    await expect(manager.createBackup('Missing Profile')).resolves.toEqual({
      success: false, error: 'Profile directory does not exist'
    });
    const missingId = 'backup-2001-01-01T00-00-00-000Z';
    await expect(manager.restoreBackup(profileName, missingId)).resolves.toEqual({
      success: false, error: 'Backup does not exist'
    });
    await expect(manager.deleteBackup(profileName, missingId)).resolves.toEqual({
      success: false, error: 'Backup does not exist'
    });
  });

  it('checkBackupRestorable accepts a listed backup whose folder exists, and nothing else', async () => {
    const created = await manager.createBackup(profileName, { mode: 'manual' });
    await expect(manager.checkBackupRestorable(profileName, created.backupId)).resolves.toEqual({ success: true });

    // A well-formed id this profile's metadata doesn't list
    await expect(manager.checkBackupRestorable(profileName, 'backup-2001-01-01T00-00-00-000Z')).resolves.toEqual({
      success: false, error: 'Backup does not exist'
    });

    // Listed, but its folder is gone
    await fs.promises.rm(path.join(manager.getBackupDirectory(profileName), created.backupId), { recursive: true });
    await expect(manager.checkBackupRestorable(profileName, created.backupId)).resolves.toEqual({
      success: false, error: 'Backup does not exist'
    });

    // Another profile's backup is not this profile's
    const other = await manager.createBackup(profileName, { mode: 'manual' });
    await expect(manager.checkBackupRestorable('Missing Profile', other.backupId)).resolves.toEqual({
      success: false, error: 'Backup does not exist'
    });
  });

  it('listBackups reports show names from the backup', async () => {
    const showsFile = path.join(profileDirectory, 'shows.json');
    const doc = { version: 1, activeShowId: 'a', shows: [
      { id: 'a', name: 'Show', layout: {} }, { id: 'b', name: 'Comedy Sports', layout: {} }
    ] };
    await fs.promises.writeFile(showsFile, JSON.stringify(doc));
    const created = await manager.createBackup(profileName, { mode: 'manual' });
    const listed = await manager.listBackups(profileName);
    expect(listed.backups.find((b) => b.id === created.backupId).shows).toEqual(['Show', 'Comedy Sports']);

    const backupShows = path.join(manager.getBackupDirectory(profileName), created.backupId, 'shows.json');
    // A damaged shows.json reads from its previous copy, as opening the profile would
    await fs.promises.writeFile(`${backupShows}.prev`, JSON.stringify({ ...doc, shows: [doc.shows[0]] }));
    await fs.promises.writeFile(backupShows, '{nope');
    const recovered = await manager.listBackups(profileName);
    expect(recovered.backups.find((b) => b.id === created.backupId).shows).toEqual(['Show']);
    // Neither copy readable: said so, not mistaken for a pre-shows backup
    await fs.promises.writeFile(`${backupShows}.prev`, '{nope');
    const corrupt = await manager.listBackups(profileName);
    expect(corrupt.backups.find((b) => b.id === created.backupId).shows).toBe('unreadable');
    // A newer version's shows.json fails the open, so its previous copy isn't what restores
    await fs.promises.writeFile(`${backupShows}.prev`, JSON.stringify(doc));
    await fs.promises.writeFile(backupShows, JSON.stringify({ ...doc, version: 2 }));
    const newer = await manager.listBackups(profileName);
    expect(newer.backups.find((b) => b.id === created.backupId).shows).toBe('unreadable');
    await fs.promises.rm(showsFile);
  });

  it('listBackups reports null shows for a pre-shows backup', async () => {
    const created = await manager.createBackup(profileName, { mode: 'manual' });
    const listed = await manager.listBackups(profileName);
    expect(listed.backups.find((b) => b.id === created.backupId).shows).toBeNull();
  });

  describe('backup ID validation', () => {
    const invalidIds = [
      ['parent traversal', '../../profiles'],
      ['traversal inside a valid-looking id', 'backup-2001-01-01T00-00-00-000Z/../../..'],
      ['traversal to a sibling profile', '../Other Profile/backup-2001-01-01T00-00-00-000Z'],
      ['absolute path', path.join(userDataDirectory, 'profiles')],
      ['empty id', ''],
      ['non-string id', undefined],
      ['malformed id', 'backup-missing'],
      ['metadata file', 'backup-metadata.json']
    ];

    it.each(invalidIds)('rejects %s in deleteBackup and leaves files intact', async (_label, backupId) => {
      await expect(manager.deleteBackup(profileName, backupId)).resolves.toEqual({
        success: false, error: 'Invalid backup ID'
      });
      await expect(fs.promises.access(path.join(profileDirectory, 'preferences.json'))).resolves.toBeUndefined();
      await expect(fs.promises.access(manager.getBackupDirectory(profileName))).resolves.toBeUndefined();
    });

    it.each(invalidIds)('rejects %s in checkBackupRestorable', async (_label, backupId) => {
      await expect(manager.checkBackupRestorable(profileName, backupId)).resolves.toEqual({
        success: false, error: 'Invalid backup ID'
      });
    });

    it.each(invalidIds)('rejects %s in restoreBackup', async (_label, backupId) => {
      await expect(manager.restoreBackup(profileName, backupId)).resolves.toEqual({
        success: false, error: 'Invalid backup ID'
      });
    });

    it('does not delete a directory outside the backup folder via traversal', async () => {
      const victim = path.join(userDataDirectory, 'profiles', 'Victim');
      await fs.promises.mkdir(victim, { recursive: true });
      await fs.promises.writeFile(path.join(victim, 'keep.txt'), 'keep');

      await expect(manager.deleteBackup(profileName, '../../profiles/Victim')).resolves.toEqual({
        success: false, error: 'Invalid backup ID'
      });
      await expect(fs.promises.readFile(path.join(victim, 'keep.txt'), 'utf8')).resolves.toBe('keep');
    });

    it('still deletes pre-restore backups created by restoreBackup', async () => {
      const created = await manager.createBackup(profileName);
      await expect(manager.restoreBackup(profileName, created.backupId)).resolves.toEqual({ success: true });

      const { backups } = await manager.listBackups(profileName);
      const preRestore = backups.find((backup) => backup.mode === 'pre-restore');
      expect(preRestore.id).toMatch(/^pre-restore-backup-/);

      await expect(manager.deleteBackup(profileName, preRestore.id)).resolves.toEqual({ success: true });
      await expect(manager.deleteBackup(profileName, created.backupId)).resolves.toEqual({ success: true });
    });
  });

  it('skips change-aware backup creation when disabled', async () => {
    await expect(manager.createBackupIfChanged(profileName, { autoBackupEnabled: false })).resolves.toEqual({
      success: true, created: false, reason: 'auto-backup disabled'
    });
  });
});
