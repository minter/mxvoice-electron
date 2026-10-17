/**
 * Startup launcher host
 *
 * Mounts the shared profile picker (renderer/modules/profile-picker) as the
 * whole startup window. Closing this window without choosing quits the app
 * (main process). Switching profiles later uses the same picker inside a
 * dialog in the main window instead.
 */

import { createProfilePicker } from './renderer/modules/profile-picker/picker-view.js';

/**
 * Wait for the preload API (it can lag on Windows)
 * @returns {Promise<void>}
 */
function waitForLauncherAPI(maxWait = 5000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const check = () => {
      if (typeof window.launcherAPI?.getProfiles === 'function' || Date.now() - startTime > maxWait) {
        resolve();
        return;
      }
      setTimeout(check, 50);
    };
    check();
  });
}

/** No profile is loaded yet, so follow the system theme */
function applyTheme() {
  const theme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-bs-theme', theme);
  document.body.classList.remove('theme-light', 'theme-dark');
  document.body.classList.add(`theme-${theme}`);
}

/**
 * Size the window to what the picker shows: the full profile list (the main
 * process caps it, and the list scrolls past that) or the New profile form.
 * The main process shows the window after the first fit.
 */
function fitWindowToContent() {
  if (typeof window.launcherAPI?.fitToContent !== 'function') return;
  const content = document.getElementById('picker-root');
  const body = content.querySelector('.profile-picker-body');
  const list = document.getElementById('profile-list');
  let height;
  if (list.offsetParent) {
    // Everything but the list keeps its height; the list takes its rows' height
    const rowsHeight = [...list.children].reduce((sum, row) => sum + row.offsetHeight, 0);
    const listBorders = list.offsetHeight - list.clientHeight;
    height = content.offsetHeight - list.offsetHeight + rowsHeight + listBorders;
  } else {
    // New profile form: grow until the body no longer scrolls
    height = content.offsetHeight - body.clientHeight + body.scrollHeight;
  }
  window.launcherAPI.fitToContent(Math.ceil(height)).catch(() => {});
}

window.addEventListener('DOMContentLoaded', async () => {
  applyTheme();
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  document.body.classList.toggle('has-titlebar', /Mac/.test(navigator.platform));

  await waitForLauncherAPI();

  const picker = createProfilePicker({
    root: document.getElementById('picker-root'),
    keyTarget: document,
    mode: 'startup',
    iconSrc: 'assets/icons/mxvoice-square.png',
    api: {
      listProfiles: () => window.launcherAPI.getProfiles(),
      createProfile: (name, description) => window.launcherAPI.createProfile(name, description),
      choose: async (name) => {
        const result = await window.launcherAPI.launchApp(name);
        // The main window is opening; the main process closes this window too
        if (result?.success) setTimeout(() => window.close(), 100);
        return result;
      }
    },
    // Runs on load, after creating a profile and on list/form changes, not while filtering
    onLayoutChange: fitWindowToContent
  });

  await picker.load();
  picker.focus();
});
