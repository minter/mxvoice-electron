/**
 * Profile Switcher
 *
 * Switches the active profile inside the running app: the main window stays
 * open and its renderer reloads into the new profile. No app.relaunch().
 * See docs/superpowers/specs/2026-10-17-in-process-profile-switch-design.md.
 *
 * @module profile-switcher
 */

import { trackProfileSwitch } from './profile-switch-analytics.js';
import { withTimeout } from './with-timeout.js';

// Stops the old page's debounced collection saves; they would otherwise land
// in the new profile once currentProfile changes
const LOCK_RENDERER_SAVES = 'window.isRestoringProfileState = true';

// The save lock waits on the page. A hung page must not wedge switching
// (every later switch would be refused as "already in progress"); the reload
// at the end replaces it anyway. The flush (prepareForSwitch) has its own
// limit in prepareMainWindowForClose.
const RENDERER_TIMEOUT_MS = 5000;

/**
 * Restore a saved window_state onto an existing window.
 * @param {Object} win - BrowserWindow
 * @param {Object|null} state - Saved window state ({ x, y, width, height, isMaximized, isFullScreen, displayId })
 * @param {Object} screen - Electron screen module
 */
export function applyWindowState(win, state, screen) {
  if (!win || win.isDestroyed() || !state || typeof state !== 'object') return;

  if (win.isFullScreen()) win.setFullScreen(false);
  if (win.isMaximized()) win.unmaximize();

  const bounds = {};
  if (state.width) bounds.width = state.width;
  if (state.height) bounds.height = state.height;
  const displayKnown = state.displayId
    && screen?.getAllDisplays().some((display) => display.id === state.displayId);
  if (displayKnown && state.x !== undefined && state.y !== undefined) {
    bounds.x = state.x;
    bounds.y = state.y;
  }
  if (Object.keys(bounds).length) win.setBounds(bounds);

  if (state.isMaximized) win.maximize();
  if (state.isFullScreen) win.setFullScreen(true);
}

/**
 * @param {Object} deps
 * @param {Function} deps.getMainWindow
 * @param {Function} deps.getCurrentProfile
 * @param {Function} deps.setCurrentProfile
 * @param {Function} deps.prepareForSwitch - Flush renderer state and window bounds for the current profile,
 *   then end its show session as a switch, which retires its crash-recovery record (time-limited
 *   itself, so a hung page can't hold the switch). The session fence and lock-renderer-saves are
 *   two separate guards against the old page's late writes.
 * @param {Object} deps.profileManager - { profileExists, updateProfileLastUsed, loadProfilePreferences }
 * @param {Object} deps.autoBackupTimer - { stopAutoBackupTimer, startAutoBackupTimer }
 * @param {Object} deps.store - Global electron-store
 * @param {Function} deps.rebuildMenu
 * @param {Function} deps.loadWindowState - (profileName) => Promise<state|null>
 * @param {Function} deps.applyWindowState - (win, state) => void
 * @param {Function} [deps.getAnalytics]
 * @param {Object} [deps.debugLog]
 * @param {number} [deps.rendererTimeoutMs] - Limit for each wait on the page
 */
export function createProfileSwitcher({
  getMainWindow,
  getCurrentProfile,
  setCurrentProfile,
  prepareForSwitch,
  profileManager,
  autoBackupTimer,
  store,
  rebuildMenu,
  loadWindowState,
  applyWindowState: applyState,
  getAnalytics = () => null,
  debugLog,
  rendererTimeoutMs = RENDERER_TIMEOUT_MS
}) {
  let inFlight = false;

  const liveWindow = () => {
    const win = getMainWindow();
    return win && !win.isDestroyed() ? win : null;
  };

  // A failed side step must not strand the user between profiles
  async function step(name, fn) {
    try {
      await fn();
    } catch (error) {
      debugLog?.warn(`Profile switch step failed: ${name}`, {
        module: 'profile-switcher',
        function: 'switchProfile',
        step: name,
        error: error?.message
      });
    }
  }

  /**
   * Switch the running app to another profile.
   * @param {string} name - Target profile
   * @param {{ method?: 'launcher'|'direct' }} [options]
   * @returns {Promise<{success: boolean, unchanged?: boolean, error?: string}>}
   */
  async function switchProfile(name, { method = 'direct' } = {}) {
    if (!name) return { success: false, error: 'Profile name is required' };
    if (inFlight) return { success: false, error: 'A profile switch is already in progress' };
    if (!profileManager.profileExists(name)) {
      return { success: false, error: `Profile "${name}" does not exist` };
    }
    const win = liveWindow();
    if (!win) return { success: false, error: 'Main window is not available' };

    const fromProfile = getCurrentProfile();
    if (fromProfile === name) return { success: true, unchanged: true };

    inFlight = true;
    try {
      debugLog?.info('Switching profile in-process', {
        module: 'profile-switcher', function: 'switchProfile', fromProfile, toProfile: name, method
      });

      // A just-deleted profile has nothing left to flush into
      if (fromProfile && profileManager.profileExists(fromProfile)) {
        await step('flush', () => prepareForSwitch());
      }

      await step('lock-renderer-saves', () => withTimeout(
        win.webContents.executeJavaScript(LOCK_RENDERER_SAVES),
        rendererTimeoutMs,
        `lock-renderer-saves timed out after ${rendererTimeoutMs}ms`
      ));

      setCurrentProfile(name);
      await step('last-used', () => profileManager.updateProfileLastUsed(name));

      await step('auto-backup', async () => {
        autoBackupTimer.stopAutoBackupTimer();
        await autoBackupTimer.startAutoBackupTimer(name);
      });

      // The auto-updater reads the global store, not profile preferences
      await step('prerelease-sync', async () => {
        const preferences = await profileManager.loadProfilePreferences(name);
        if (preferences && 'prerelease_updates' in preferences) {
          store.set('prerelease_updates', preferences.prerelease_updates);
        }
      });

      await step('menu', () => rebuildMenu());
      await step('window-bounds', async () => applyState(win, await loadWindowState(name)));

      trackProfileSwitch({ analytics: getAnalytics(), fromProfile, toProfile: name, method });

      if (!win.isDestroyed()) win.webContents.reload();
      return { success: true };
    } finally {
      inFlight = false;
    }
  }

  return { switchProfile };
}

export default createProfileSwitcher;
