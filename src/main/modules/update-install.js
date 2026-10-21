/**
 * Update Install
 *
 * Install a downloaded update. quitAndInstall() closes every window before
 * before-quit fires, so save state first: that save also hands the show
 * session off, so the next launch restores the show in progress. The
 * "Quit Mx. Voice?" confirmation (which would cancel the install) is skipped
 * from before-quit-for-update, not here: if this install doesn't quit, closes
 * must still ask and save.
 *
 * An install that doesn't quit (the updater reports an error, quitAndInstall
 * throws, or no quit starts within `timeoutMs`) gives the session back with
 * `cancelHandoff`, so the show keeps saving, and tells the user. Once the
 * app's before-quit fires the quit is underway and nothing is given back.
 *
 * @module update-install
 */

/**
 * @param {Object} deps
 * @param {() => Promise<void>} deps.prepareForUpdateInstall
 * @param {() => Object} deps.getAutoUpdater - electron-updater's autoUpdater
 * @param {() => Promise<void>} [deps.cancelHandoff] - give the show session back
 * @param {(listener: () => void) => (() => void)} [deps.onQuitStarted] - subscribe
 *   to the app's before-quit; returns the unsubscribe
 * @param {() => void} [deps.notifyInstallFailed] - tell the user the install didn't happen
 * @param {Object} [deps.debugLog]
 * @param {number} [deps.timeoutMs]
 * @returns {() => Promise<void>}
 */
export function createUpdateInstaller({
  prepareForUpdateInstall,
  getAutoUpdater,
  cancelHandoff,
  onQuitStarted,
  notifyInstallFailed,
  debugLog,
  timeoutMs = 15000
}) {
  const logCtx = { module: 'update-install', function: 'installUpdateNow' };
  // The attempt until it settles (quit started, or given back); a second
  // call meanwhile reuses it instead of adding listeners of its own
  let pending = null;

  async function giveBack(why, error) {
    debugLog?.warn('The update install did not quit; giving the show session back', {
      ...logCtx, why, error: error?.message
    });
    try {
      await cancelHandoff?.();
    } catch (cancelError) {
      debugLog?.error('Could not give the show session back', { ...logCtx, error: cancelError.message });
    }
    try {
      notifyInstallFailed?.();
    } catch (notifyError) {
      debugLog?.error('Could not tell the user the update was not installed', { ...logCtx, error: notifyError.message });
    }
  }

  async function attempt() {
    try {
      await prepareForUpdateInstall();
    } catch (error) {
      debugLog?.warn('Could not save state before installing the update', { ...logCtx, error: error.message });
    }

    const updater = getAutoUpdater();
    let settled = false;
    let timer = null;
    let unsubscribe = null;
    // Ends the attempt either way; the first outcome wins
    const settle = () => {
      if (settled) return false;
      settled = true;
      clearTimeout(timer);
      updater.removeListener?.('error', onError);
      unsubscribe?.();
      pending = null;
      return true;
    };
    const fail = (why, error) => {
      if (settle()) giveBack(why, error);
    };
    function onError(error) {
      fail('updater-error', error);
    }

    unsubscribe = onQuitStarted?.(() => settle()) ?? null;
    updater.on?.('error', onError);
    timer = setTimeout(() => fail('timeout'), timeoutMs);
    try {
      updater.quitAndInstall();
    } catch (error) {
      fail('quitAndInstall-threw', error);
    }
  }

  return function installUpdateNow() {
    if (!pending) {
      pending = attempt().catch((error) => {
        pending = null;
        throw error;
      });
    }
    return pending;
  };
}

export default { createUpdateInstaller };
