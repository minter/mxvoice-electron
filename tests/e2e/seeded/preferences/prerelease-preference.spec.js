import { _electron as electron, test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { launchSeededApp, closeApp, waitForAppReady } from '../../../utils/seeded-launch.js';

// "Include prerelease updates" is saved per profile, but the auto-updater reads
// the global config.json copy, which another profile's Preferences save may have
// left different. The profile the app opens on decides it, before the first check.

test.describe('Preferences - prerelease updates follow the open profile', () => {
  let app; let page; let userDataDir;

  test.afterEach(async () => {
    await closeApp(app);
  });

  const readGlobal = () => JSON.parse(fs.readFileSync(path.join(userDataDir, 'config.json'), 'utf8')).prerelease_updates;

  for (const [profileValue, globalValue] of [[true, false], [false, true]]) {
    test(`a profile with it ${profileValue ? 'on' : 'off'} sets the global copy, which said ${globalValue ? 'on' : 'off'}`, async () => {
      ({ app, page, userDataDir } = await launchSeededApp(electron, 'prerelease-preference', {
        beforeLaunch: (dir) => {
          const configPath = path.join(dir, 'config.json');
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          fs.writeFileSync(configPath, JSON.stringify({ ...config, prerelease_updates: globalValue }, null, 2));
          const profileDir = path.join(dir, 'profiles', 'Default User');
          fs.mkdirSync(profileDir, { recursive: true });
          fs.writeFileSync(path.join(profileDir, 'preferences.json'), JSON.stringify({ prerelease_updates: profileValue }, null, 2));
        }
      }));
      await waitForAppReady(page, app);

      await expect.poll(readGlobal).toBe(profileValue);
      // The profile's own setting is untouched
      const preferences = await page.evaluate(() => window.secureElectronAPI.profile.getPreference('prerelease_updates'));
      expect(preferences?.value).toBe(profileValue);
    });
  }
});
