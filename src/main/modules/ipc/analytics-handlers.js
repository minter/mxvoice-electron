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
      // The analytics sink centrally enforces consent and opt-out for all callers.
      analytics?.trackEvent(name, properties || {});
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
      return { success: true, value: !!store.get('analytics_opt_out') };
    } catch (error) {
      debugLog?.error('Analytics get-opt-out error', { module: 'ipc-handlers', function: 'analytics:get-opt-out-status', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.ANALYTICS.SET_OPT_OUT, async (event, value) => {
    try {
      if (analytics) {
        analytics.setOptOut(!!value);
      } else {
        // Preserve the choice even if the optional analytics module did not load.
        store.set('analytics_opt_out', !!value);
      }
      return { success: true };
    } catch (error) {
      debugLog?.error('Analytics set-opt-out error', { module: 'ipc-handlers', function: 'analytics:set-opt-out', error: error.message });
      return { success: false, error: error.message };
    }
  });
}
