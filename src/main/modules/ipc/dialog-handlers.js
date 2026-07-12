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
  const { debugLog, mainWindow } = deps;

  ipcMain.handle(IPC.DIALOG.SHOW_DIRECTORY_PICKER, async (event, defaultPath) => {
    let path = dialog.showOpenDialogSync({
      defaultPath: defaultPath,
      properties: ['openDirectory']
    });
    return path;
  });

  // File operations
  ipcMain.handle(IPC.DIALOG.OPEN_HOTKEY_FILE, async () => {
    return await fileOperations.loadHotkeysFile();
  });

  ipcMain.handle(IPC.DIALOG.SAVE_HOTKEY_FILE, async (event, hotkeyArray) => {
    return await fileOperations.saveHotkeysFile(hotkeyArray);
  });

  ipcMain.handle(IPC.DIALOG.OPEN_HOLDING_TANK_FILE, async () => {
    return await fileOperations.loadHoldingTankFile();
  });

  ipcMain.handle(IPC.DIALOG.SAVE_HOLDING_TANK_FILE, async (event, holdingTankArray) => {
    return await fileOperations.saveHoldingTankFile(holdingTankArray);
  });

  ipcMain.handle(IPC.DIALOG.SHOW_FILE_PICKER, async (event, options = {}) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, options);
      return { success: true, data: result };
    } catch (error) {
      debugLog?.error('Show file picker error:', { module: 'ipc-handlers', function: 'show-file-picker', error: error.message });
      return { success: false, error: error.message };
    }
  });
}
