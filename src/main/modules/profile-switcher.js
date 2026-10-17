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

const DEFAULT_PROFILE = 'Default User';

// Stops the old page's debounced collection saves; they would otherwise land
// in the new profile once currentProfile changes
const LOCK_RENDERER_SAVES = 'window.isRestoringProfileState = true';

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
 * @param {Function} deps.prepareForSwitch - Flush renderer state and window bounds for the current profile
 * @param {Object} deps.profileManager - { profileExists, updateProfileLastUsed, loadProfilePreferences }
 * @param {Object} deps.autoBackupTimer - { stopAutoBackupTimer, startAutoBackupTimer }
 * @param {Object} deps.store - Global electron-store
 * @param {Function} deps.rebuildMenu
 * @param {Function} deps.loadWindowState - (profileName) => Promise<state|null>
 * @param {Function} deps.applyWindowState - (win, state) => void
 * @param {Function} deps.openLauncher - Show the profile picker in switch mode
 * @param {Function} [deps.getAnalytics]
 * @param {Object} [deps.debugLog]
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
  openLauncher,
  getAnalytics = () => null,
  debugLog
}) {
  let inFlight = false;
  let savesFenced = false;
  let pickerOpen = false;

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

      savesFenced = true;
      await step('lock-renderer-saves', () => win.webContents.executeJavaScript(LOCK_RENDERER_SAVES));

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

      savesFenced = false;
      if (!win.isDestroyed()) win.webContents.reload();
      return { success: true };
    } finally {
      savesFenced = false;
      inFlight = false;
    }
  }

  function showMainWindow() {
    const win = liveWindow();
    if (!win) return;
    win.show();
    win.focus();
  }

  /**
   * Hide the main window and show the profile picker. The session stays in
   * memory until a different profile is chosen.
   */
  async function openPicker() {
    if (pickerOpen) {
      await openLauncher();
      return { success: true };
    }
    pickerOpen = true;

    const current = getCurrentProfile();
    const win = liveWindow();
    if (win && current && !profileManager.profileExists(current)) {
      // Deleted from the menu: nothing may write it back while the picker is up
      await step('lock-renderer-saves', () => win.webContents.executeJavaScript(LOCK_RENDERER_SAVES));
    }

    try {
      win?.hide();
      await openLauncher();
      return { success: true };
    } catch (error) {
      pickerOpen = false;
      showMainWindow();
      return { success: false, error: error.message };
    }
  }

  /** Launcher callback: a profile was chosen while switching. */
  async function onPickerChoice(name) {
    // On failure the picker stays up so the user can choose again or cancel
    const result = await switchProfile(name, { method: 'launcher' });
    if (!result.success) throw new Error(result.error);
    pickerOpen = false;
    showMainWindow();
    return result;
  }

  /** Launcher callback: closed without choosing. */
  async function onPickerCancel() {
    pickerOpen = false;
    const current = getCurrentProfile();
    if (!current || !profileManager.profileExists(current)) {
      await switchProfile(DEFAULT_PROFILE, { method: 'launcher' });
    }
    showMainWindow();
  }

  return {
    switchProfile,
    openPicker,
    onPickerChoice,
    onPickerCancel,
    isPickerOpen: () => pickerOpen,
    // Implicit (current-profile) state saves are refused while true
    isSavingFenced: () => savesFenced
  };
}

export default createProfileSwitcher;
