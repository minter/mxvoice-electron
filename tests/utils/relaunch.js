import fs from 'fs';
import { execFileSync } from 'child_process';
import os from 'os';
import electronPath from 'electron';

/**
 * Launch the app again on an existing user-data directory, without wiping or
 * reseeding it. Mirrors launchSeededApp's environment (E2E_USER_DATA_DIR,
 * --profile=, an isolated HOME/APPDATA).
 *
 * @returns {Promise<{ app, page, fakeHome }>}
 */
export async function relaunchApp(electron, userDataDir, { profile = 'Default User' } = {}) {
  const fakeHome = fs.mkdtempSync(`${os.tmpdir()}/mxv-home-`);
  const app = await electron.launch({
    executablePath: electronPath,
    args: ['.', `--profile=${profile}`],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      APP_TEST_MODE: '1',
      DISABLE_HARDWARE_ACCELERATION: '1',
      AUTO_UPDATE: '0',
      E2E_USER_DATA_DIR: userDataDir,
      HOME: fakeHome,
      APPDATA: fakeHome,
    },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page, fakeHome };
}

/**
 * Wait until the page has finished opening its show: the restoration lock is
 * held while the crash prompt is open, so once it is released no prompt can
 * still be showing. Use before waitForAppReady, whose click would dismiss one.
 * The predicate must stay synchronous.
 */
export async function waitForShowSettled(page) {
  await page.waitForFunction(() => window.isRestoringProfileState === false, null, { timeout: 20000 });
}

/** Kill the app without any shutdown path, as a crash would. */
export async function crashApp(app) {
  const child = app.process();
  const exited = new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve();
    else child.once('exit', resolve);
  });
  if (process.platform === 'win32' && child.exitCode === null) {
    // Killing only the main process on Windows leaves its renderer and GPU
    // processes running for a while, holding the user-data folder; the
    // relaunch then dies at startup. Take the whole tree down, as a crash of
    // the app does.
    try {
      execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      child.kill('SIGKILL');
    }
  } else {
    child.kill('SIGKILL');
  }
  await exited;
}
