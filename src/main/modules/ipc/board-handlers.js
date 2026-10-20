/**
 * Board IPC handlers.
 *
 * Thin wrappers over the main-process board session. The session captured
 * its profile at open, so no handler takes a profile name from the renderer.
 */

import electron from 'electron';
const { ipcMain } = electron;
import ipcChannels from '../../../shared/ipc-channels.cjs';
const { IPC } = ipcChannels;

export function register(deps) {
  const { boardSession, debugLog } = deps;

  // Every handler returns { success: true, data } or { success: false, error }
  function handle(channel, name, run) {
    ipcMain.handle(channel, async (_event, ...args) => {
      try {
        if (!boardSession) throw new Error('Board session unavailable');
        const data = await run(...args);
        return { success: true, data: data === undefined ? null : data };
      } catch (error) {
        debugLog?.error?.('Board IPC failed', {
          module: 'board-handlers',
          function: name,
          error: error.message
        });
        return { success: false, error: error.message };
      }
    });
  }

  handle(IPC.BOARDS.OPEN, 'open', () => boardSession.open());
  handle(IPC.BOARDS.START_EMPTY, 'startEmpty', () => boardSession.startEmpty());
  handle(IPC.BOARDS.RESOLVE_RECOVERY, 'resolveRecovery', (choice) => boardSession.resolveRecovery(choice));
  handle(IPC.BOARDS.REPORT_READY, 'reportReady', (generation, ok) => boardSession.reportReady(generation, ok === true));
  handle(IPC.BOARDS.SAVE_RECOVERY, 'saveRecovery', (layout) => boardSession.saveRecovery(layout));
  handle(IPC.BOARDS.GET_STATE, 'getState', () => boardSession.state());
}
