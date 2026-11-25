/**
 * Store (electron-store) IPC handlers.
 * Bodies moved verbatim from ipc-handlers.js — see that file's git history.
 */

import electron from 'electron';
const { ipcMain } = electron;
import ipcChannels from '../../../shared/ipc-channels.cjs';
import { assertTrustedMainFrame } from './guards.js';
const { IPC } = ipcChannels;

export function register(deps) {
  const { store, debugLog, getMainWindow, directoryPreferenceAuthority, trustedRendererUrl } = deps;

  ipcMain.handle(IPC.STORE.GET, async (event, key) => {
    try {
      assertTrustedMainFrame(event, getMainWindow, trustedRendererUrl);
      const value = store.get(key);
      debugLog?.info('Store get', { module: 'ipc-handlers', function: 'store-get', key, valueType: typeof value });
      return { success: true, value };
    } catch (error) {
      debugLog?.error('Store get error:', { module: 'ipc-handlers', function: 'store-get', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.STORE.HAS, async (event, key) => {
    try {
      assertTrustedMainFrame(event, getMainWindow, trustedRendererUrl);
      return { success: true, has: store.has(key) };
    } catch (error) {
      debugLog?.error('Store has error:', { module: 'ipc-handlers', function: 'store-has', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.STORE.SET_DEBUG_LOG_ENABLED, async (event, enabled) => {
    try {
      assertTrustedMainFrame(event, getMainWindow, trustedRendererUrl);
      if (typeof enabled !== 'boolean') throw new Error('Debug logging preference must be boolean');
      store.set('debug_log_enabled', enabled);
      return { success: true, value: store.get('debug_log_enabled') };
    } catch (error) {
      debugLog?.error('Debug logging preference error:', {
        module: 'ipc-handlers',
        function: 'store:set-debug-log-enabled',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.STORE.MARK_ANALYTICS_BANNER_SHOWN, async (event) => {
    try {
      assertTrustedMainFrame(event, getMainWindow, trustedRendererUrl);
      store.set('analytics_banner_shown', true);
      return { success: true, value: true };
    } catch (error) {
      debugLog?.error('Analytics banner preference error:', {
        module: 'ipc-handlers',
        function: 'store:mark-analytics-banner-shown',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.STORE.SET_DIRECTORY_PREFERENCE, async (event, key, authorizationToken) => {
    try {
      assertTrustedMainFrame(event, getMainWindow, trustedRendererUrl);
      const value = directoryPreferenceAuthority.setDirectoryPreference(
        key,
        authorizationToken,
        event.sender
      );
      return { success: true, value };
    } catch (error) {
      debugLog?.error('Directory preference error:', {
        module: 'ipc-handlers',
        function: 'store:set-directory-preference',
        key,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });
}
