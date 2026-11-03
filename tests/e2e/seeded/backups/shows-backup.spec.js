import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp, waitForAppReady } from '../../../utils/seeded-launch.js';
import {
  showsDocument,
  hotkeyLayout,
  profileShowsPath,
  readShows,
  recoveryRecordPath,
  seedShows
} from '../../../utils/seed-shows.js';
import fs from 'fs';
import path from 'path';

test.describe('Profile backups, duplicate and delete with shows', () => {
  let app;
  let page;
  let userDataDir;

  test.beforeAll(async () => {
    ({ app, page, userDataDir } = await launchSeededApp(electron, 'shows-backup'));
    await page.waitForFunction(() => !!window.moduleRegistry, { timeout: 15000 });
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  const twoShows = () => ({
    version: 1,
    activeShowId: 'b2',
    shows: [
      { id: 'b1', name: 'Show', createdAt: 1, updatedAt: 1, layout: hotkeyLayout({ f1: '1001' }) },
      { id: 'b2', name: 'Comedy Sports', createdAt: 2, updatedAt: 2, layout: hotkeyLayout({ f1: '1002' }) }
    ]
  });

  test('restoring a pre-shows backup migrates it into "Default Show"', async () => {
    seedShows(userDataDir, 'Default User', showsDocument(hotkeyLayout({ f1: '1001' })));
    const created = await page.evaluate(() => window.secureElectronAPI.profile.createBackup());
    expect(created.success).toBe(true);

    // Turn the backup into a pre-shows one: only state.json and preferences.json
    const backupDir = path.join(userDataDir, 'profile-backups', 'Default User', created.backupId);
    fs.rmSync(path.join(backupDir, 'shows.json'), { force: true });
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
    expect(listed.backups.find((b) => b.id === created.backupId).shows).toBeNull();

    // The live profile now has a different, multi-show document
    seedShows(userDataDir, 'Default User', twoShows());
    const restored = await page.evaluate((id) => window.secureElectronAPI.profile.restoreBackup(id), created.backupId);
    expect(restored.success).toBe(true);
    expect(fs.existsSync(profileShowsPath(userDataDir, 'Default User'))).toBe(false);

    await page.reload();
    await waitForAppReady(page, app);

    const doc = readShows(userDataDir, 'Default User');
    expect(doc.shows).toHaveLength(1);
    expect(doc.shows[0].name).toBe('Default Show');
    expect(doc.shows[0].layout.hotkeys[0].hotkeys.f1).toBe('1003');
  });

  test('backup list reports the show names of a shows backup', async () => {
    seedShows(userDataDir, 'Default User', twoShows());
    const created = await page.evaluate(() => window.secureElectronAPI.profile.createBackup());
    expect(created.success).toBe(true);
    const listed = await page.evaluate(() => window.secureElectronAPI.profile.listBackups());
    expect(listed.backups.find((b) => b.id === created.backupId).shows).toEqual(['Show', 'Comedy Sports']);
  });

  test('duplicate profile copies shows and the active show, not recovery', async () => {
    const created = await page.evaluate(() => window.secureElectronAPI.profile.createProfile('Source Show', ''));
    expect(created.success).toBe(true);
    seedShows(userDataDir, 'Source Show', twoShows());
    const recoveryFile = recoveryRecordPath(userDataDir, 'Source Show');
    fs.mkdirSync(path.dirname(recoveryFile), { recursive: true });
    fs.writeFileSync(recoveryFile, JSON.stringify({ savedAt: Date.now(), layout: hotkeyLayout({ f1: '1004' }) }));

    const dup = await page.evaluate(() => window.secureElectronAPI.profile.duplicateProfile('Source Show', 'Copy Show', ''));
    expect(dup.success).toBe(true);

    expect(readShows(userDataDir, 'Copy Show')).toEqual(readShows(userDataDir, 'Source Show'));
    expect(readShows(userDataDir, 'Copy Show').activeShowId).toBe('b2');
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
