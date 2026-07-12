/**
 * UI IPC handlers.
 * Bodies moved verbatim from ipc-handlers.js — see that file's git history.
 */

import electron from 'electron';
const { ipcMain } = electron;
import ipcChannels from '../../../shared/ipc-channels.cjs';
const { IPC } = ipcChannels;

export function register(deps) {
  const { getMainWindow } = deps;

  // UI operations
  ipcMain.handle(IPC.UI.INCREASE_FONT_SIZE, async () => {
    getMainWindow().webContents.send("increase_font_size");
  });

  ipcMain.handle(IPC.UI.DECREASE_FONT_SIZE, async () => {
    getMainWindow().webContents.send("decrease_font_size");
  });

  ipcMain.handle(IPC.UI.TOGGLE_WAVEFORM, async () => {
    getMainWindow().webContents.send("toggle_wave_form");
  });

  ipcMain.handle(IPC.UI.TOGGLE_ADVANCED_SEARCH, async () => {
    getMainWindow().webContents.send("toggle_advanced_search");
  });

  ipcMain.handle(IPC.UI.CLOSE_ALL_TABS, async () => {
    getMainWindow().webContents.send("close_all_tabs");
  });

  // Category operations
  ipcMain.handle(IPC.UI.MANAGE_CATEGORIES, async () => {
    getMainWindow().webContents.send('manage_categories');
  });

  // Preferences
  ipcMain.handle(IPC.UI.SHOW_PREFERENCES, async () => {
    getMainWindow().webContents.send('show_preferences');
  });
}
