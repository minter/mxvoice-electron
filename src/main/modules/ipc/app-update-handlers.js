/**
 * App / auto-update IPC handlers.
 * Bodies moved verbatim from ipc-handlers.js — see that file's git history.
 */

import electron from 'electron';
const { ipcMain, app } = electron;
import ipcChannels from '../../../shared/ipc-channels.cjs';
const { IPC } = ipcChannels;

export function register(deps) {
  const { autoUpdater, updateState, debugLog, analytics } = deps;

  // App operations for secure API
  ipcMain.handle(IPC.APP.GET_PATH, async (event, name) => {
    try {
      return { success: true, data: app.getPath(name) };
    } catch (error) {
      debugLog?.error('App get path error:', { module: 'ipc-handlers', function: 'app-get-path', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.APP.GET_VERSION, async () => {
    try {
      return { success: true, data: app.getVersion() };
    } catch (error) {
      debugLog?.error('App get version error:', { module: 'ipc-handlers', function: 'app-get-version', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.APP.GET_NAME, async () => {
    try {
      return { success: true, data: app.getName() };
    } catch (error) {
      debugLog?.error('App get name error:', { module: 'ipc-handlers', function: 'app-get-name', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.APP.QUIT, async () => {
    try {
      app.quit();
      return { success: true };
    } catch (error) {
      debugLog?.error('App quit error:', { module: 'ipc-handlers', function: 'app-quit', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.APP.RESTART, async () => {
    try {
      app.relaunch();
      app.exit();
      return { success: true };
    } catch (error) {
      debugLog?.error('App restart error:', { module: 'ipc-handlers', function: 'app-restart', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.APP.RESTART_AND_INSTALL, async () => {
    try {
      if (autoUpdater) {
        autoUpdater.quitAndInstall();
        return { success: true };
      } else {
        throw new Error('Auto updater not available');
      }
    } catch (error) {
      debugLog?.error('Restart and install error:', { module: 'ipc-handlers', function: 'restart-and-install-new-version', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // Auto-update handlers - Three-stage process for better UX

  // Stage 1: Check for updates (no download)
  ipcMain.handle(IPC.APP.CHECK_FOR_UPDATE, async () => {
    try {
      debugLog.info('🔍 Checking for updates...', {
        module: 'ipc-handlers',
        function: 'check-for-update',
        currentVersion: app.getVersion()
      });

      if (!autoUpdater) {
        throw new Error('Auto updater not available');
      }

      // Reset download state
      updateState.downloaded = false;
      updateState.userApprovedInstall = false;

      const result = await autoUpdater.checkForUpdates();
      return {
        success: true,
        updateAvailable: !!result?.updateInfo,
        updateInfo: result?.updateInfo || null
      };
    } catch (error) {
      debugLog.error('Check for update error:', {
        module: 'ipc-handlers',
        function: 'check-for-update',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  // Stage 2: Download update (user-initiated)
  ipcMain.handle(IPC.APP.DOWNLOAD_UPDATE, async () => {
    try {
      debugLog.info('📥 Starting update download...', {
        module: 'ipc-handlers',
        function: 'download-update'
      });

      if (!autoUpdater) {
        throw new Error('Auto updater not available');
      }

      // Download with timeout to prevent hangs
      const downloadPromise = autoUpdater.downloadUpdate();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Download timeout after 60 seconds')), 60000)
      );

      await Promise.race([downloadPromise, timeoutPromise]);
      if (analytics) {
        analytics.trackEvent('auto_update_action', { action: 'accepted' });
      }
      return { success: true, message: 'Download started' };
    } catch (error) {
      const errorMessage = error?.message || error?.toString() || 'Download failed';
      debugLog.error('Download update error:', {
        module: 'ipc-handlers',
        function: 'download-update',
        error: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  });

  // Stage 3: Install update (only if downloaded)
  ipcMain.handle(IPC.APP.INSTALL_UPDATE, async () => {
    try {
      debugLog.info('🚀 Installing update...', {
        module: 'ipc-handlers',
        function: 'install-update',
        downloaded: !!updateState?.downloaded
      });

      if (!autoUpdater) {
        throw new Error('Auto updater not available');
      }

      if (!updateState?.downloaded) {
        throw new Error('No update has been downloaded yet');
      }

      // Install and restart immediately
      setImmediate(() => {
        autoUpdater.quitAndInstall();
      });

      return { success: true, message: 'Installing and restarting...' };
    } catch (error) {
      const errorMessage = error?.message || error?.toString() || 'Install failed';
      debugLog.error('Install update error:', {
        module: 'ipc-handlers',
        function: 'install-update',
        error: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  });
}
