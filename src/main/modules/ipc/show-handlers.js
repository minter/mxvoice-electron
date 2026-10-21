/**
 * Show IPC handlers.
 *
 * Thin wrappers over the main-process show session. The session captured
 * its profile at open, so no handler takes the current profile's name from
 * the renderer. IMPORT names a source profile, checked against the registry.
 */

import electron from 'electron';
const { ipcMain } = electron;
import ipcChannels from '../../../shared/ipc-channels.cjs';
import * as profileManager from '../profile-manager.js';
import { isShowColor } from '../show-document.js';
const { IPC } = ipcChannels;

const SHOW_ID = /^[0-9a-f-]{36}$/;

function checkShowId(showId) {
  if (typeof showId !== 'string' || !SHOW_ID.test(showId)) throw new Error('Invalid show id');
}

// A palette key, or null to clear the color
function checkShowColor(color) {
  if (color !== null && !isShowColor(color)) throw new Error('Invalid show color');
}

const SONG_ID = /^\d+$/;
// More ids than any show can hold
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
  const { showSession, debugLog } = deps;

  // Every handler returns { success: true, data } or { success: false, error },
  // plus code 'invalid-name' for a show name validation failure
  function handle(channel, name, run) {
    ipcMain.handle(channel, async (_event, ...args) => {
      try {
        if (!showSession) throw new Error('Show session unavailable');
        const data = await run(...args);
        return { success: true, data: data === undefined ? null : data };
      } catch (error) {
        debugLog?.error?.('Show IPC failed', {
          module: 'show-handlers',
          function: name,
          error: error.message
        });
        // A show name the user can correct says so, so the page re-asks
        return error?.code === 'invalid-name'
          ? { success: false, error: error.message, code: 'invalid-name' }
          : { success: false, error: error.message };
      }
    });
  }

  handle(IPC.SHOWS.OPEN, 'open', () => showSession.open());
  handle(IPC.SHOWS.START_EMPTY, 'startEmpty', () => showSession.startEmpty());
  handle(IPC.SHOWS.RESOLVE_RECOVERY, 'resolveRecovery', (choice) => showSession.resolveRecovery(choice));
  handle(IPC.SHOWS.REPORT_READY, 'reportReady', (generation, ok, details) => {
    const droppedIds = checkDroppedIds(details);
    return showSession.reportReady(generation, ok === true, { droppedIds });
  });
  handle(IPC.SHOWS.SAVE_RECOVERY, 'saveRecovery', (layout) => showSession.saveRecovery(layout));
  handle(IPC.SHOWS.GET_STATE, 'getState', () => showSession.state());
  handle(IPC.SHOWS.ACTIVATE, 'activate', (showId) => {
    checkShowId(showId);
    return showSession.activate(showId);
  });
  handle(IPC.SHOWS.REVERT, 'revert', () => showSession.revert());
  handle(IPC.SHOWS.UPDATE_ACTIVE, 'updateActive', (layout) => showSession.updateActive(layout));
  handle(IPC.SHOWS.CREATE, 'createShow', (name, layout) => showSession.createShow(name, layout));
  handle(IPC.SHOWS.RENAME, 'renameShow', (showId, name) => {
    checkShowId(showId);
    return showSession.renameShow(showId, name);
  });
  handle(IPC.SHOWS.DELETE, 'deleteShow', (showId) => {
    checkShowId(showId);
    return showSession.deleteShow(showId);
  });
  handle(IPC.SHOWS.LIST_IMPORTABLE, 'listImportable', () => showSession.listImportable());
  handle(IPC.SHOWS.IMPORT, 'importShow', (profile, showId) => {
    checkProfile(profile);
    checkShowId(showId);
    return showSession.importShow(profile, showId);
  });
  handle(IPC.SHOWS.SET_COLOR, 'setShowColor', (showId, color) => {
    checkShowId(showId);
    checkShowColor(color);
    return showSession.setShowColor(showId, color);
  });
}
