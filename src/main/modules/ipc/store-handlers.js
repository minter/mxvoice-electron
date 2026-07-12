/**
 * Store (electron-store) IPC handlers.
 * Bodies moved verbatim from ipc-handlers.js — see that file's git history.
 */

import electron from 'electron';
const { ipcMain } = electron;
import ipcChannels from '../../../shared/ipc-channels.cjs';
const { IPC } = ipcChannels;

export function register(deps) {
  const { store, debugLog } = deps;

  ipcMain.handle(IPC.STORE.GET, async (event, key) => {
    try {
      const value = store.get(key);
      debugLog?.info('Store get', { module: 'ipc-handlers', function: 'store-get', key, valueType: typeof value });
      return { success: true, value };
    } catch (error) {
      debugLog?.error('Store get error:', { module: 'ipc-handlers', function: 'store-get', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.STORE.SET, async (event, key, value) => {
    try {
      debugLog?.info('Store set', { module: 'ipc-handlers', function: 'store-set', key, valueType: typeof value });
      store.set(key, value);
      const verify = store.get(key);
      return { success: true, value: verify };
    } catch (error) {
      debugLog?.error('Store set error:', { module: 'ipc-handlers', function: 'store-set', key, error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.STORE.DELETE, async (event, key) => {
    try {
      store.delete(key);
      return { success: true };
    } catch (error) {
      debugLog?.error('Store delete error:', { module: 'ipc-handlers', function: 'store-delete', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.STORE.HAS, async (event, key) => {
    try {
      return { success: true, has: store.has(key) };
    } catch (error) {
      debugLog?.error('Store has error:', { module: 'ipc-handlers', function: 'store-has', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.STORE.KEYS, async () => {
    try {
      return { success: true, keys: Object.keys(store.store) };
    } catch (error) {
      debugLog?.error('Store keys error:', { module: 'ipc-handlers', function: 'store-keys', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.STORE.CLEAR, async () => {
    try {
      store.clear();
      return { success: true };
    } catch (error) {
      debugLog?.error('Store clear error:', { module: 'ipc-handlers', function: 'store-clear', error: error.message });
      return { success: false, error: error.message };
    }
  });
}
