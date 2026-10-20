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
 * @module update-install
 */

/**
 * @param {Object} deps
 * @param {() => Promise<void>} deps.prepareForUpdateInstall
 * @param {() => Object} deps.getAutoUpdater - electron-updater's autoUpdater
 * @param {Object} [deps.debugLog]
 * @returns {() => Promise<void>}
 */
export function createUpdateInstaller({ prepareForUpdateInstall, getAutoUpdater, debugLog }) {
  return async function installUpdateNow() {
    try {
      await prepareForUpdateInstall();
    } catch (error) {
      debugLog?.warn('Could not save state before installing the update', {
        module: 'update-install',
        function: 'installUpdateNow',
        error: error.message
      });
    }
    getAutoUpdater().quitAndInstall();
  };
}

export default { createUpdateInstaller };
