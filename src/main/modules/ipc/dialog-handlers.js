/**
 * Dialog IPC handlers.
 * Bodies moved verbatim from ipc-handlers.js — see that file's git history.
 */

import electron from 'electron';
const { ipcMain, dialog } = electron;
import ipcChannels from '../../../shared/ipc-channels.cjs';
const { IPC } = ipcChannels;
import fileOperations from '../file-operations.js';

export function register(deps) {
  const { debugLog, getMainWindow } = deps;

  ipcMain.handle(IPC.DIALOG.SHOW_DIRECTORY_PICKER, async (event, defaultPath) => {
    let path = dialog.showOpenDialogSync({
      defaultPath: defaultPath,
      properties: ['openDirectory']
    });
    return path;
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
