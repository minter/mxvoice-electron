/**
 * Manual Update Check
 *
 * Check for Updates… in the app menu (macOS) or Help menu (Windows/Linux).
 * A found update opens the usual release-notes modal: the update-available
 * handler treats any check that isn't a background one as user-initiated.
 * This module tells the user about the outcomes that would otherwise stay
 * silent: already up to date, an update already downloading or downloaded,
 * a failed check, or a build that can't update itself.
 *
 * @module manual-update-check
 */

import { isDownloadGuardActive } from './pending-update.js';

/**
 * @param {Object} deps
 * @param {Object|null} deps.autoUpdater - electron-updater's autoUpdater
 * @param {Object} deps.updateState - Shared updater state
 * @param {boolean} deps.isPackaged - Unpackaged builds never check
 * @param {string} deps.appName
 * @param {string} deps.currentVersion
 * @param {() => boolean} deps.hasWindow - Whether a live main window can show the release notes
 * @param {(options: Object) => Promise<{ response: number }>} deps.showMessage - Shows a message box
 * @param {() => Promise<void>} deps.installUpdate - Installs a downloaded update
 * @param {() => number} [deps.now]
 * @returns {Promise<'busy'|'unavailable'|'downloading'|'downloaded'|'available'|'up-to-date'|'failed'>}
 */
export async function runManualUpdateCheck({
  autoUpdater,
  updateState,
  isPackaged,
  appName,
  currentVersion,
  hasWindow,
  showMessage,
  installUpdate,
  now = Date.now,
}) {
  const unavailable = async () => {
    await showMessage({
      type: 'info',
      message: "Can't check for updates",
      detail: `This copy of ${appName} isn't an installed release, so it can't update itself.`,
    });
    return 'unavailable';
  };

  if (updateState.manualCheck) return 'busy';
  if (!autoUpdater || !isPackaged) return unavailable();

  if (updateState.downloaded) {
    const { response } = await showMessage({
      type: 'info',
      message: `${appName} ${updateState.downloadedVersion} is ready to install`,
      detail: `${appName} will restart to install it.`,
      buttons: ['Restart and Install', 'Later'],
      // Restarting mid-show is the costly mistake, so Return keeps the app open
      defaultId: 1,
      cancelId: 1,
    });
    if (response === 0) await installUpdate();
    return 'downloaded';
  }

  if (isDownloadGuardActive(updateState, now())) {
    await showMessage({
      type: 'info',
      message: 'An update is already downloading',
      detail: `${appName} will restart to install it when the download finishes.`,
    });
    return 'downloading';
  }

  updateState.manualCheck = true;
  let result;
  try {
    // electron-updater merges concurrent checks into one; if a background
    // check is in flight, the user's request must still get the modal
    updateState.backgroundCheck = false;
    result = await autoUpdater.checkForUpdates();
  } catch {
    // The autoUpdater 'error' handler logs it and reports update_failed
    await showMessage({
      type: 'warning',
      message: "Couldn't check for updates",
      detail: 'Check your internet connection and try again.',
    });
    return 'failed';
  } finally {
    updateState.manualCheck = false;
  }

  if (!result) return unavailable();

  if (!result.isUpdateAvailable) {
    await showMessage({
      type: 'info',
      message: "You're up to date",
      detail: `${appName} ${currentVersion} is the newest version available.`,
    });
    return 'up-to-date';
  }

  // With no window (macOS keeps running without one) the modal can't open;
  // the next window's launch check offers it
  if (!hasWindow()) {
    await showMessage({
      type: 'info',
      message: `${appName} ${result.updateInfo?.version} is available`,
      detail: `Open the ${appName} window to see what's new and install it.`,
    });
  }
  return 'available';
}
