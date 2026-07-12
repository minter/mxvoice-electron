/**
 * Library transfer IPC handlers.
 * Bodies moved verbatim from ipc-handlers.js — see that file's git history.
 */

import electron from 'electron';
const { ipcMain, dialog, app } = electron;
import path from 'path';
import * as libraryTransferManager from '../library-transfer-manager.js';
import ipcChannels from '../../../shared/ipc-channels.cjs';
const { IPC } = ipcChannels;

export function register(deps) {
  const { getMainWindow, debugLog } = deps;

  // Library Transfer handlers
  ipcMain.handle(IPC.LIBRARY.EXPORT, async () => {
    try {
      const result = await dialog.showSaveDialog(getMainWindow(), {
        buttonLabel: 'Export',
        filters: [{ name: 'Mx. Voice Library', extensions: ['mxvlib'] }],
        defaultPath: path.join(app.getPath('documents'), 'MxVoice-Library.mxvlib'),
        message: 'Choose where to save your library export'
      });

      if (result.canceled) {
        return { success: false, canceled: true };
      }

      const progressCallback = (progress) => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send('library:export-progress', progress);
        }
      };

      return await libraryTransferManager.exportLibrary(result.filePath, progressCallback);
    } catch (error) {
      debugLog?.error('Library export handler error:', {
        module: 'ipc-handlers', function: 'library:export', error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.LIBRARY.IMPORT, async () => {
    try {
      const result = await dialog.showOpenDialog(getMainWindow(), {
        buttonLabel: 'Import',
        filters: [{ name: 'Mx. Voice Library', extensions: ['mxvlib'] }],
        message: 'Select a Mx. Voice library file to import',
        properties: ['openFile']
      });

      if (result.canceled || !result.filePaths.length) {
        return { success: false, canceled: true };
      }

      const archivePath = result.filePaths[0];

      // Notify the renderer that validation is starting so it can show a loading modal
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('library:import-progress', {
          percent: 0,
          message: 'Validating library file...'
        });
      }

      const validation = await libraryTransferManager.validateArchive(archivePath);
      if (!validation.success) {
        return validation;
      }

      return { success: true, archivePath, manifest: validation.manifest };
    } catch (error) {
      debugLog?.error('Library import handler error:', {
        module: 'ipc-handlers', function: 'library:import', error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.LIBRARY.IMPORT_CONFIRM, async (_event, archivePath) => {
    try {
      const progressCallback = (progress) => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send('library:import-progress', progress);
        }
      };

      return await libraryTransferManager.importLibrary(archivePath, progressCallback);
    } catch (error) {
      debugLog?.error('Library import confirm handler error:', {
        module: 'ipc-handlers', function: 'library:import-confirm', error: error.message
      });
      return { success: false, error: error.message };
    }
  });
}
