/**
 * Update Scheduler
 *
 * Re-checks for updates while the app stays open. Installs at venues can run
 * for weeks without a restart, and the launch-time check alone never sees
 * updates published after launch.
 *
 * Background checks must never interrupt a show, so they don't open the
 * release-notes modal; the renderer shows a quiet toolbar indicator instead.
 *
 * @module update-scheduler
 */

export const BACKGROUND_UPDATE_INTERVAL_MS = 12 * 60 * 60 * 1000;

/**
 * How to tell the user about an available update.
 *
 * @param {Object} params
 * @param {string} params.version - Version offered by the updater
 * @param {boolean} params.background - Whether a background check found it
 * @param {string|null} params.lastQuietVersion - Version last announced quietly
 * @param {boolean} [params.windowAvailable=true] - Whether a live main window can show it.
 *   On macOS the app keeps running with its window closed; the version must stay
 *   unannounced so the next check shows it once a window exists again.
 * @returns {'modal'|'quiet'|'none'}
 */
export function decideUpdateNotice({ version, background, lastQuietVersion, windowAvailable = true }) {
  if (!windowAvailable) return 'none';
  if (!background) return 'modal';
  return version === lastQuietVersion ? 'none' : 'quiet';
}

/**
 * Run one background update check. `updateState.backgroundCheck` is set while
 * it runs so the updater's update-available handler knows not to open the modal.
 *
 * @returns {Promise<boolean>} Whether a check was started
 */
export async function runBackgroundCheck({ autoUpdater, updateState }) {
  if (!autoUpdater || updateState.downloading || updateState.downloaded || updateState.backgroundCheck) {
    return false;
  }
  updateState.backgroundCheck = true;
  try {
    await autoUpdater.checkForUpdates();
  } catch {
    // Reported by the autoUpdater 'error' handler as update_failed
  } finally {
    updateState.backgroundCheck = false;
  }
  return true;
}

/**
 * Schedule background checks. The timer is unref'd so it never keeps the
 * process alive on quit.
 *
 * @returns {Function} Stops the schedule
 */
export function startBackgroundUpdateChecks({
  autoUpdater,
  updateState,
  intervalMs = BACKGROUND_UPDATE_INTERVAL_MS,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
}) {
  const timer = setIntervalFn(() => runBackgroundCheck({ autoUpdater, updateState }), intervalMs);
  timer?.unref?.();
  return () => clearIntervalFn(timer);
}
