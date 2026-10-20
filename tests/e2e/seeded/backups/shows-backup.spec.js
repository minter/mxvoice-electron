import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp, waitForAppReady } from '../../../utils/seeded-launch.js';
import {
  boardsDocument,
  hotkeyLayout,
  profileBoardsPath,
  readBoards,
  recoveryRecordPath,
  seedBoards
} from '../../../utils/seed-boards.js';
import fs from 'fs';
import path from 'path';

test.describe('Profile backups, duplicate and delete with boards', () => {
  let app;
  let page;
  let userDataDir;

  test.beforeAll(async () => {
    ({ app, page, userDataDir } = await launchSeededApp(electron, 'boards-backup'));
    await page.waitForFunction(() => !!window.moduleRegistry, { timeout: 15000 });
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  const twoBoards = () => ({
    version: 1,
    activeBoardId: 'b2',
    boards: [
      { id: 'b1', name: 'Board', createdAt: 1, updatedAt: 1, layout: hotkeyLayout({ f1: '1001' }) },
      { id: 'b2', name: 'Comedy Sports', createdAt: 2, updatedAt: 2, layout: hotkeyLayout({ f1: '1002' }) }
    ]
  });

  test('restoring a pre-boards backup migrates it into "Board"', async () => {
    seedBoards(userDataDir, 'Default User', boardsDocument(hotkeyLayout({ f1: '1001' })));
    const created = await page.evaluate(() => window.secureElectronAPI.profile.createBackup());
    expect(created.success).toBe(true);

    // Turn the backup into a pre-boards one: only state.json and preferences.json
    const backupDir = path.join(userDataDir, 'profile-backups', 'Default User', created.backupId);
    fs.rmSync(path.join(backupDir, 'boards.json'), { force: true });
    fs.writeFileSync(path.join(backupDir, 'state.json'), JSON.stringify({
      version: '1.0.0',
      timestamp: 1700000000000,
      hotkeys: [{ tabNumber: 1, tabName: 'Legacy Keys', hotkeys: { f1: '1003' } }],
      holdingTank: [{ tabNumber: 1, tabName: null, songIds: [] }]
    }));
    if (!fs.existsSync(path.join(backupDir, 'preferences.json'))) {
      fs.writeFileSync(path.join(backupDir, 'preferences.json'), '{}');
    }

    const listed = await page.evaluate(() => window.secureElectronAPI.profile.listBackups());
    expect(listed.backups.find((b) => b.id === created.backupId).boards).toBeNull();

    // The live profile now has a different, multi-board document
    seedBoards(userDataDir, 'Default User', twoBoards());
    const restored = await page.evaluate((id) => window.secureElectronAPI.profile.restoreBackup(id), created.backupId);
    expect(restored.success).toBe(true);
    expect(fs.existsSync(profileBoardsPath(userDataDir, 'Default User'))).toBe(false);

    await page.reload();
    await waitForAppReady(page, app);

    const doc = readBoards(userDataDir, 'Default User');
    expect(doc.boards).toHaveLength(1);
    expect(doc.boards[0].name).toBe('Board');
    expect(doc.boards[0].layout.hotkeys[0].hotkeys.f1).toBe('1003');
  });

  test('backup list reports the board names of a boards backup', async () => {
    seedBoards(userDataDir, 'Default User', twoBoards());
    const created = await page.evaluate(() => window.secureElectronAPI.profile.createBackup());
    expect(created.success).toBe(true);
    const listed = await page.evaluate(() => window.secureElectronAPI.profile.listBackups());
    expect(listed.backups.find((b) => b.id === created.backupId).boards).toEqual(['Board', 'Comedy Sports']);
  });

  test('duplicate profile copies boards and the active board, not recovery', async () => {
    const created = await page.evaluate(() => window.secureElectronAPI.profile.createProfile('Source Show', ''));
    expect(created.success).toBe(true);
    seedBoards(userDataDir, 'Source Show', twoBoards());
    const recoveryFile = recoveryRecordPath(userDataDir, 'Source Show');
    fs.mkdirSync(path.dirname(recoveryFile), { recursive: true });
    fs.writeFileSync(recoveryFile, JSON.stringify({ savedAt: Date.now(), layout: hotkeyLayout({ f1: '1004' }) }));

    const dup = await page.evaluate(() => window.secureElectronAPI.profile.duplicateProfile('Source Show', 'Copy Show', ''));
    expect(dup.success).toBe(true);

    expect(readBoards(userDataDir, 'Copy Show')).toEqual(readBoards(userDataDir, 'Source Show'));
    expect(readBoards(userDataDir, 'Copy Show').activeBoardId).toBe('b2');
    expect(fs.existsSync(recoveryRecordPath(userDataDir, 'Copy Show'))).toBe(false);
    expect(fs.existsSync(recoveryFile)).toBe(true);
  });

  test('deleting a profile removes its recovery record', async () => {
    const recoveryFile = recoveryRecordPath(userDataDir, 'Source Show');
    fs.mkdirSync(path.dirname(recoveryFile), { recursive: true });
    fs.writeFileSync(recoveryFile, JSON.stringify({ savedAt: Date.now(), layout: hotkeyLayout({ f1: '1004' }) }));

    const deleted = await page.evaluate(() => window.secureElectronAPI.profile.deleteProfile('Source Show'));
    expect(deleted.success).toBe(true);
    expect(fs.existsSync(path.join(userDataDir, 'profiles', 'Source Show'))).toBe(false);
    expect(fs.existsSync(recoveryFile)).toBe(false);
  });
});
