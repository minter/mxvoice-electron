/**
 * Renderer Crash Handler
 *
 * The main window's page died (crash, out of memory, killed). Hand the board
 * session off first, so the crash-recovery record survives whatever comes
 * next, then offer to reload: the reloaded page restores the show in
 * progress. Quitting keeps the record for the next launch.
 *
 * @module renderer-crash-handler
 */

export const RENDERER_GONE_MESSAGE =
  "Mx. Voice's window stopped working. Reload it and restore the show in progress?";

const RELOAD = 0;
const QUIT = 1;

/**
 * @param {Object} deps
 * @param {Object} deps.boardSession - from createBoardSession
 * @param {Object} deps.dialog - Electron dialog
 * @param {() => Object|null} deps.getMainWindow
 * @param {Object} deps.app - Electron app
 * @param {Object} [deps.debugLog]
 * @returns {(event: Object, details: { reason: string, exitCode?: number }) => Promise<void>}
 *   listener for webContents 'render-process-gone'
 */
export function createRendererGoneHandler({ boardSession, dialog, getMainWindow, app, debugLog }) {
  const logCtx = { module: 'renderer-crash-handler', function: 'onRenderProcessGone' };

  return async (_event, details = {}) => {
    // Electron reports a normal page exit this way too
    if (details.reason === 'clean-exit') return;

    debugLog?.error('Main window renderer is gone', { ...logCtx, reason: details.reason, exitCode: details.exitCode });
    boardSession.rendererGone();

    const window = getMainWindow();
    if (!window || window.isDestroyed()) return;

    let response;
    try {
      if (process.env.APP_TEST_MODE === '1') {
        // E2E seam: no native dialog. Tests set the answer and read the count.
        globalThis.__e2eRendererCrashPrompts = (globalThis.__e2eRendererCrashPrompts || 0) + 1;
        response = (globalThis.__e2eRendererCrashAnswer || 'reload') === 'reload' ? RELOAD : QUIT;
      } else {
        ({ response } = await dialog.showMessageBox(window, {
          type: 'error',
          buttons: ['Reload', 'Quit'],
          defaultId: RELOAD,
          cancelId: RELOAD,
          message: RENDERER_GONE_MESSAGE
        }));
      }
    } catch (error) {
      // No way to ask: quitting keeps the record for the next launch
      debugLog?.error('Could not ask about the stopped window; quitting', { ...logCtx, error: error.message });
      app.quit();
      return;
    }

    if (response === RELOAD) {
      const live = getMainWindow();
      if (live && !live.isDestroyed()) live.webContents.reload();
    } else {
      app.quit();
    }
  };
}

export default { createRendererGoneHandler, RENDERER_GONE_MESSAGE };
