import { _electron as electron, test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'node:path';
import { launchSeededApp, waitForAppReady } from '../../../utils/seeded-launch.js';
import { relaunchApp, waitForShowSettled } from '../../../utils/relaunch.js';
import { readShows, seedShows } from '../../../utils/seed-shows.js';
import {
  f1Hotkey,
  importHoldingTankFile,
  importHotkeyFile,
  multiShowDocument,
  quitApp,
  waitForShowMenuReady
} from '../../../utils/show-e2e.js';

// Seeded songs: 1001 Got The Time, 1002 The Wheel, 1003, 1004 We Are Family, 1005 Eat It.
const PROFILE = 'Default User';

test.describe('Shows - legacy file import', () => {
  let app;
  let page;
  let userDataDir;
  let suiteRoot;
  let tempDir;
  const homes = [];

  async function stubOpenDialog(filePath) {
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    }, filePath);
  }

  test.beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-legacy-import-'));
    ({ app, page, userDataDir, suiteRoot } = await launchSeededApp(electron, 'legacy-import', {
      beforeLaunch: (dir) => seedShows(dir, PROFILE, multiShowDocument([
        { name: 'Main Show', hotkeys: { f1: '1002' } }
      ]))
    }));
    await waitForAppReady(page, app);
    await waitForShowMenuReady(app);
  });

  test.afterEach(async () => {
    await app?.close().catch(() => {});
    app = null;
    for (const home of homes.splice(0)) fs.rmSync(home, { recursive: true, force: true });
    if (suiteRoot) fs.rmSync(suiteRoot, { recursive: true, force: true });
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('panel headers no longer have open or save buttons', async () => {
    for (const id of ['hotkey-load-btn', 'hotkey-save-btn', 'holding-tank-load-btn', 'holding-tank-save-btn']) {
      await expect(page.locator(`#${id}`)).toHaveCount(0);
    }
  });

  test('a hotkey file import skips songs missing from the library', async () => {
    const file = path.join(tempDir, 'old.mrv');
    fs.writeFileSync(file, ['f1::1001', 'f2::99999', 'f3::1003'].join('\n'));
    await stubOpenDialog(file);

    await importHotkeyFile(app);

    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1001');
    await expect(page.locator('#hotkeys_list_1 #f3_hotkey')).toHaveAttribute('songid', '1003');
    await expect(page.locator('#hotkeys_list_1 #f2_hotkey')).not.toHaveAttribute('songid', /.+/);
    await expect(page.locator('#file-drop-toast')).toHaveText("1 song in this file isn't in your library.");
  });

  test('a holding-tank file import ignores non-numeric lines', async () => {
    const file = path.join(tempDir, 'old.hld');
    fs.writeFileSync(file, ['1004', 'not-an-id', '1002'].join('\n'));
    await stubOpenDialog(file);

    await importHoldingTankFile(app);

    await expect(page.locator('#holding_tank_1 li[songid]')).toHaveCount(2, { timeout: 5000 });
    const ids = await page.locator('#holding_tank_1 li[songid]').evaluateAll(
      (items) => items.map((item) => item.getAttribute('songid'))
    );
    expect(ids).toEqual(['1004', '1002']);
    await expect(page.locator('#file-drop-toast')).toHaveCount(0);
  });

  test('importing a file changes only the live session', async () => {
    const file = path.join(tempDir, 'old.mrv');
    fs.writeFileSync(file, 'f1::1001\n');
    await stubOpenDialog(file);

    await importHotkeyFile(app);
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1001');

    const saved = readShows(userDataDir, PROFILE);
    expect(saved.shows[0].layout.hotkeys[0].hotkeys.f1).toBe('1002');

    await quitApp(app);
    let fakeHome;
    ({ app, page, fakeHome } = await relaunchApp(electron, userDataDir, { profile: PROFILE }));
    homes.push(fakeHome);
    await waitForShowSettled(page);
    await waitForAppReady(page, app);
    await expect(f1Hotkey(page)).toHaveAttribute('songid', '1002');
  });
});
