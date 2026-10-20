/**
 * Board IPC handlers.
 *
 * Thin wrappers over the main-process board session. The session captured
 * its profile at open, so no handler takes the current profile's name from
 * the renderer. IMPORT names a source profile, checked against the registry.
 */

import electron from 'electron';
const { ipcMain } = electron;
import ipcChannels from '../../../shared/ipc-channels.cjs';
import * as profileManager from '../profile-manager.js';
const { IPC } = ipcChannels;

const BOARD_ID = /^[0-9a-f-]{36}$/;

function checkBoardId(boardId) {
  if (typeof boardId !== 'string' || !BOARD_ID.test(boardId)) throw new Error('Invalid board id');
}

const SONG_ID = /^\d+$/;
// More ids than any board can hold
const MAX_DROPPED_IDS = 10000;

function checkDroppedIds(details) {
  const droppedIds = details?.droppedIds ?? [];
  const valid = Array.isArray(droppedIds)
    && droppedIds.length <= MAX_DROPPED_IDS
    && droppedIds.every((id) => typeof id === 'string' && SONG_ID.test(id));
  if (!valid) throw new Error('Invalid dropped song ids');
  return droppedIds;
}

// profileExists uses `in`, so inherited names such as 'constructor' pass it;
// the session's listProfiles() check is what rejects those and is required
function checkProfile(profile) {
  if (typeof profile !== 'string' || !profileManager.profileExists(profile)) {
    throw new Error('Profile is not registered');
  }
}

export function register(deps) {
  const { boardSession, debugLog } = deps;

  // Every handler returns { success: true, data } or { success: false, error },
  // plus code 'invalid-name' for a board name validation failure
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
        // A board name the user can correct says so, so the page re-asks
        return error?.code === 'invalid-name'
          ? { success: false, error: error.message, code: 'invalid-name' }
          : { success: false, error: error.message };
      }
    });
  }

  handle(IPC.BOARDS.OPEN, 'open', () => boardSession.open());
  handle(IPC.BOARDS.START_EMPTY, 'startEmpty', () => boardSession.startEmpty());
  handle(IPC.BOARDS.RESOLVE_RECOVERY, 'resolveRecovery', (choice) => boardSession.resolveRecovery(choice));
  handle(IPC.BOARDS.REPORT_READY, 'reportReady', (generation, ok, details) => {
    const droppedIds = checkDroppedIds(details);
    return boardSession.reportReady(generation, ok === true, { droppedIds });
  });
  handle(IPC.BOARDS.SAVE_RECOVERY, 'saveRecovery', (layout) => boardSession.saveRecovery(layout));
  handle(IPC.BOARDS.GET_STATE, 'getState', () => boardSession.state());
  handle(IPC.BOARDS.ACTIVATE, 'activate', (boardId) => {
    checkBoardId(boardId);
    return boardSession.activate(boardId);
  });
  handle(IPC.BOARDS.REVERT, 'revert', () => boardSession.revert());
  handle(IPC.BOARDS.UPDATE_ACTIVE, 'updateActive', (layout) => boardSession.updateActive(layout));
  handle(IPC.BOARDS.CREATE, 'createBoard', (name, layout) => boardSession.createBoard(name, layout));
  handle(IPC.BOARDS.RENAME, 'renameBoard', (boardId, name) => {
    checkBoardId(boardId);
    return boardSession.renameBoard(boardId, name);
  });
  handle(IPC.BOARDS.DELETE, 'deleteBoard', (boardId) => {
    checkBoardId(boardId);
    return boardSession.deleteBoard(boardId);
  });
  handle(IPC.BOARDS.LIST_IMPORTABLE, 'listImportable', () => boardSession.listImportable());
  handle(IPC.BOARDS.IMPORT, 'importBoard', (profile, boardId) => {
    checkProfile(profile);
    checkBoardId(boardId);
    return boardSession.importBoard(profile, boardId);
  });
}
