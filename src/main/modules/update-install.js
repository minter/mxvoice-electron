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
 * On macOS, electron-updater's download is only half of it: Squirrel.Mac then
 * fetches the update from electron-updater's local server, and quitAndInstall()
 * before that finishes only queues the quit for whenever it does. So the
 * install first waits, with the session still live, for Squirrel to have the
 * update (`waitForInstallReady`); a Squirrel error then only tells the user.
 * The wait has a ceiling (`installReadyTimeoutMs`): past it the attempt is
 * dropped, the user is told, and a Squirrel fetch that finishes later never
 * quits for it. The session was never handed off, so nothing is given back.
 *
 * Then the quit phase: an install that doesn't quit (the updater reports an
 * error, quitAndInstall throws, or no quit starts within `timeoutMs`) gives
 * the session back with `cancelHandoff`, so the show keeps saving, and tells
 * the user. Once a quit has started (the app's before-quit, or the native
 * updater's before-quit-for-update) nothing is given back. Should the
 * updater quit for the update after the session was given back anyway,
 * `onQuitForUpdate` hands it off again (`handOffAgain`).
 *
 * @module update-install
 */

/**
 * @param {Object} deps
 * @param {() => Promise<void>} deps.prepareForUpdateInstall
 * @param {() => Object} deps.getAutoUpdater - electron-updater's autoUpdater
 * @param {() => Promise<void>} [deps.waitForInstallReady] - resolves once the
 *   update can be installed right away (Squirrel.Mac has it); rejects if it can't
 * @param {() => Promise<void>} [deps.cancelHandoff] - give the show session back
 * @param {() => Promise<void>} [deps.handOffAgain] - hand a given-back session off again
 * @param {(listener: () => void) => (() => void)} [deps.onQuitStarted] - subscribe
 *   to the start of a quit for this attempt; returns the unsubscribe
 * @param {(listener: () => void) => void} [deps.onQuitForUpdate] - subscribe,
 *   for the process's life, to the updater quitting to install
 * @param {() => void} [deps.notifyInstallFailed] - tell the user the install didn't happen
 * @param {Object} [deps.debugLog]
 * @param {number} [deps.timeoutMs] - how long the quit may take to start
 * @param {number} [deps.installReadyTimeoutMs] - how long to wait for Squirrel.Mac
 * @returns {() => Promise<void>}
 */
export function createUpdateInstaller({
  prepareForUpdateInstall,
  getAutoUpdater,
  waitForInstallReady,
  cancelHandoff,
  handOffAgain,
  onQuitStarted,
  onQuitForUpdate,
  notifyInstallFailed,
  debugLog,
  timeoutMs = 15000,
  installReadyTimeoutMs = 120000
}) {
  const logCtx = { module: 'update-install', function: 'installUpdateNow' };
  // The attempt until it settles (quit started, or given back); a second
  // call meanwhile reuses it instead of adding listeners of its own
  let pending = null;
  // The last attempt gave the session back and nothing has handed it off since
  let givenBack = false;

  function notify() {
    try {
      notifyInstallFailed?.();
    } catch (notifyError) {
      debugLog?.error('Could not tell the user the update was not installed', { ...logCtx, error: notifyError.message });
    }
  }

  async function giveBack(why, error) {
    debugLog?.warn('The update install did not quit; giving the show session back', {
      ...logCtx, why, error: error?.message
    });
    givenBack = true;
    try {
      await cancelHandoff?.();
    } catch (cancelError) {
      debugLog?.error('Could not give the show session back', { ...logCtx, error: cancelError.message });
    }
    notify();
  }

  // Backstop: the updater quits for the update after all. Called at once:
  // handoff() raises its fence before its first await, so no recovery write
  // gets a turn before the session is fenced again.
  onQuitForUpdate?.(() => {
    if (!givenBack) return;
    givenBack = false;
    debugLog?.warn('The updater is quitting after the session was given back; handing it off again', logCtx);
    const failed = (error) => {
      debugLog?.error('Could not hand the show session off again', { ...logCtx, error: error.message });
    };
    try {
      Promise.resolve(handOffAgain?.()).catch(failed);
    } catch (error) {
      failed(error);
    }
  });

  // Resolves true once Squirrel has the update, false past the ceiling.
  // electron-updater starts Squirrel's fetch itself right after its own
  // download only because autoInstallOnAppQuit is left at its default, true
  // (MacUpdater); with it false nothing would fetch and this would only end
  // at the ceiling.
  function untilInstallReady() {
    let timer = null;
    const ceiling = new Promise((resolve) => {
      timer = setTimeout(() => resolve(false), installReadyTimeoutMs);
    });
    return Promise.race([waitForInstallReady().then(() => true), ceiling])
      .finally(() => clearTimeout(timer));
  }

  async function attempt() {
    if (waitForInstallReady) {
      let ready;
      try {
        ready = await untilInstallReady();
      } catch (error) {
        // Nothing was handed off yet: the show never stopped saving
        debugLog?.warn('The update could not be made ready to install', { ...logCtx, error: error?.message });
        pending = null;
        notify();
        return;
      }
      if (!ready) {
        // Dropped: a fetch that finishes later must not quit mid-show
        debugLog?.warn('Squirrel did not have the update in time; the install is dropped', {
          ...logCtx, waitedMs: installReadyTimeoutMs
        });
        pending = null;
        notify();
        return;
      }
    }

    givenBack = false;
    try {
      await prepareForUpdateInstall();
    } catch (error) {
      debugLog?.warn('Could not save state before installing the update', { ...logCtx, error: error.message });
    }

    const updater = getAutoUpdater();
    let settled = false;
    let timer = null;
    let unsubscribe = null;
    // Ends the quit phase either way; the first outcome wins
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

/**
 * Whether Squirrel.Mac has the update electron-updater downloaded, tracked
 * from the native updater's own events from startup. Create it before the
 * app's own electron-updater listeners: a new download starts a new fetch,
 * which forgets the last fetch's error.
 *
 * @param {Object} deps
 * @param {Object} deps.nativeUpdater - Electron's autoUpdater
 * @param {Object} deps.updater - electron-updater's autoUpdater
 * @returns {{ waitUntilReady: () => Promise<void> }}
 */
export function createSquirrelReadiness({ nativeUpdater, updater }) {
  let downloaded = false;
  let failure = null;
  let waiters = [];
  const settleWaiters = (fn) => {
    const current = waiters;
    waiters = [];
    current.forEach(fn);
  };

  nativeUpdater.on('update-downloaded', () => {
    downloaded = true;
    failure = null;
    settleWaiters(({ resolve }) => resolve());
  });
  nativeUpdater.on('error', (error) => {
    if (downloaded) return;
    failure = error;
    settleWaiters(({ reject }) => reject(error));
  });
  const onNewDownload = () => { failure = null; };
  if (updater.prependListener) updater.prependListener('update-downloaded', onNewDownload);
  else updater.on('update-downloaded', onNewDownload);

  return {
    waitUntilReady() {
      if (downloaded) return Promise.resolve();
      if (failure) return Promise.reject(failure);
      return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
    }
  };
}

export default { createUpdateInstaller, createSquirrelReadiness };
