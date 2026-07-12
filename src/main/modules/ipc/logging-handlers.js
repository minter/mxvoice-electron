/**
 * Logging IPC handlers.
 * Bodies moved verbatim from ipc-handlers.js — see that file's git history.
 */

import electron from 'electron';
const { ipcMain } = electron;
import ipcChannels from '../../../shared/ipc-channels.cjs';
const { IPC } = ipcChannels;

export function register(deps) {
  const { debugLog, logService } = deps;

  // Preload logging — fire-and-forget via ipcRenderer.send (sandbox-safe)
  ipcMain.on(IPC.LOGGING.PRELOAD_LOG, (_event, level, message, context) => {
    if (debugLog && typeof debugLog[level] === 'function') {
      debugLog[level](message, context);
    }
  });

  // Logs API (centralized log service)
  ipcMain.handle(IPC.LOGGING.WRITE, async (_event, payload) => {
    try {
      logService?.write(payload);
      return { success: true };
    } catch (error) {
      debugLog?.error('Logs write error', { module: 'ipc-handlers', function: 'logs:write', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.LOGGING.GET_PATHS, async () => {
    try {
      const paths = logService?.getPaths();
      return { success: true, ...paths };
    } catch (error) {
      debugLog?.error('Logs get-paths error', { module: 'ipc-handlers', function: 'logs:get-paths', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.LOGGING.EXPORT, async (_event, options) => {
    try {
      const result = await logService?.exportLogs(options || {});
      return result || { success: false };
    } catch (error) {
      debugLog?.error('Logs export error', { module: 'ipc-handlers', function: 'logs:export', error: error.message });
      return { success: false, error: error.message };
    }
  });
}
