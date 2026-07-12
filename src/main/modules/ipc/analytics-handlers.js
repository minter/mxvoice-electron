/**
 * Analytics IPC handlers.
 * Bodies moved verbatim from ipc-handlers.js — see that file's git history.
 */

import electron from 'electron';
const { ipcMain } = electron;
import ipcChannels from '../../../shared/ipc-channels.cjs';
const { IPC } = ipcChannels;

export function register(deps) {
  const { analytics, store, debugLog } = deps;

  // Analytics handlers
  ipcMain.handle(IPC.ANALYTICS.TRACK_EVENT, async (event, name, properties) => {
    try {
      // Skip events fired before the user has seen the consent banner.
      // Mirrors the gate around app_launched in main/index-modular.js so
      // renderer-side handlers (errors, etc.) don't leak events on first run.
      if (analytics && store.get('analytics_banner_shown')) {
        analytics.trackEvent(name, properties || {});
      }
      return { success: true };
    } catch (error) {
      debugLog?.error('Analytics track-event error', { module: 'ipc-handlers', function: 'analytics:track-event', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.ANALYTICS.GET_OPT_OUT_STATUS, async () => {
    try {
      if (analytics) {
        return { success: true, value: analytics.getOptOutStatus() };
      }
      return { success: true, value: false };
    } catch (error) {
      debugLog?.error('Analytics get-opt-out error', { module: 'ipc-handlers', function: 'analytics:get-opt-out-status', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.ANALYTICS.SET_OPT_OUT, async (event, value) => {
    try {
      if (analytics) {
        analytics.setOptOut(!!value);
      }
      return { success: true };
    } catch (error) {
      debugLog?.error('Analytics set-opt-out error', { module: 'ipc-handlers', function: 'analytics:set-opt-out', error: error.message });
      return { success: false, error: error.message };
    }
  });
}
