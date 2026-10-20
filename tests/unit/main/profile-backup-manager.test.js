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
    await expect(manager.restoreBackup(profileName, 'backup-missing')).resolves.toEqual({
      success: false, error: 'Backup does not exist'
    });
    await expect(manager.deleteBackup(profileName, 'backup-missing')).resolves.toEqual({
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

    await fs.promises.writeFile(path.join(manager.getBackupDirectory(profileName), created.backupId, 'shows.json'), '{nope');
    const corrupt = await manager.listBackups(profileName);
    expect(corrupt.backups.find((b) => b.id === created.backupId).shows).toBeNull();
    await fs.promises.rm(showsFile);
  });

  it('listBackups reports null shows for a pre-shows backup', async () => {
    const created = await manager.createBackup(profileName, { mode: 'manual' });
    const listed = await manager.listBackups(profileName);
    expect(listed.backups.find((b) => b.id === created.backupId).shows).toBeNull();
  });

  it('skips change-aware backup creation when disabled', async () => {
    await expect(manager.createBackupIfChanged(profileName, { autoBackupEnabled: false })).resolves.toEqual({
      success: true, created: false, reason: 'auto-backup disabled'
    });
  });
});
