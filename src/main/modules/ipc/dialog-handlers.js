/**
 * Dialog IPC handlers.
 * Bodies moved verbatim from ipc-handlers.js — see that file's git history.
 */

import electron from 'electron';
const { ipcMain, dialog } = electron;
import ipcChannels from '../../../shared/ipc-channels.cjs';
const { IPC } = ipcChannels;
import fileOperations from '../file-operations.js';
import { assertTrustedMainFrame } from './guards.js';

const DIRECTORY_PICKER_TITLES = Object.freeze({
  database_directory: 'Select Database File Directory',
  music_directory: 'Select Audio Files Directory',
  hotkey_directory: 'Select Hotkey Files Directory'
});

export function register(deps) {
  const { debugLog, getMainWindow, directoryPreferenceAuthority, trustedRendererUrl } = deps;

  ipcMain.handle(IPC.DIALOG.SHOW_DIRECTORY_PICKER, async (event, defaultPath, preferenceKey) => {
    try {
      assertTrustedMainFrame(event, getMainWindow, trustedRendererUrl);
      if (preferenceKey !== undefined && !directoryPreferenceAuthority.supports(preferenceKey)) {
        throw new Error('Unsupported directory preference');
      }

      const options = { properties: ['openDirectory'] };
      if (typeof defaultPath === 'string' && defaultPath !== '') options.defaultPath = defaultPath;
      if (preferenceKey) options.title = DIRECTORY_PICKER_TITLES[preferenceKey];

      const result = await dialog.showOpenDialog(getMainWindow(), options);
      const data = {
        canceled: result.canceled,
        filePaths: result.filePaths
      };
      if (!result.canceled && preferenceKey && result.filePaths[0]) {
        data.authorizationToken = directoryPreferenceAuthority.authorizeSelection(
          preferenceKey,
          result.filePaths[0],
          event.sender
        );
      }
      return { success: true, data };
    } catch (error) {
      debugLog?.error('Show directory picker error:', {
        module: 'ipc-handlers',
        function: 'show-directory-picker',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  // Tab files: each shows its own dialog and returns { success, data } or { success: false, error }
  ipcMain.handle(IPC.FILE.SAVE_HOTKEY_TAB, (event, tab, label) => fileOperations.saveHotkeyTabFile(tab, label));
  ipcMain.handle(IPC.FILE.SAVE_HOLDING_TANK_TAB, (event, songIds, label) => fileOperations.saveHoldingTankTabFile(songIds, label));
  ipcMain.handle(IPC.FILE.LOAD_HOTKEY_TAB, () => fileOperations.loadHotkeyTabFile());
  ipcMain.handle(IPC.FILE.LOAD_HOLDING_TANK_TAB, () => fileOperations.loadHoldingTankTabFile());

  ipcMain.handle(IPC.DIALOG.SHOW_FILE_PICKER, async (event, options = {}) => {
    try {
      const result = await dialog.showOpenDialog(getMainWindow(), options);
      return { success: true, data: result };
    } catch (error) {
      debugLog?.error('Show file picker error:', { module: 'ipc-handlers', function: 'show-file-picker', error: error.message });
      return { success: false, error: error.message };
    }
  });
}
