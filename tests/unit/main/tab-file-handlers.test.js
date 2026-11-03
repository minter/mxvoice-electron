import fs from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const handlers = new Map();
vi.mock('electron', () => {
  const ipcMain = { handle: (channel, handler) => handlers.set(channel, handler) };
  return { default: { ipcMain, dialog: {} }, ipcMain, dialog: {} };
});
const fileOperations = {
  saveHotkeyTabFile: vi.fn(async () => ({ success: true, data: { path: '/x.mrv' } })),
  saveHoldingTankTabFile: vi.fn(async () => ({ success: true, data: { canceled: true } })),
  loadHotkeyTabFile: vi.fn(async () => ({ success: true, data: { hotkeys: { f1: '1' }, tabName: null } })),
  loadHoldingTankTabFile: vi.fn(async () => ({ success: false, error: 'bad' }))
};
vi.mock('../../../src/main/modules/file-operations.js', () => ({ default: fileOperations }));

const { IPC } = (await import('../../../src/shared/ipc-channels.cjs')).default;

beforeAll(async () => {
  const { register } = await import('../../../src/main/modules/ipc/dialog-handlers.js');
  register({ debugLog: null, getMainWindow: () => null });
});

describe('tab file IPC', () => {
  it('names the four channels in the manifest', () => {
    expect(IPC.FILE).toEqual({
      SAVE_HOTKEY_TAB: 'file:save-hotkey-tab',
      SAVE_HOLDING_TANK_TAB: 'file:save-holding-tank-tab',
      LOAD_HOTKEY_TAB: 'file:load-hotkey-tab',
      LOAD_HOLDING_TANK_TAB: 'file:load-holding-tank-tab'
    });
  });

  it('saves through the file operations and returns their result', async () => {
    const tab = { tabNumber: 1, tabName: 'A', hotkeys: { f1: '1' } };
    await expect(handlers.get(IPC.FILE.SAVE_HOTKEY_TAB)({}, tab, 'A')).resolves.toEqual({ success: true, data: { path: '/x.mrv' } });
    expect(fileOperations.saveHotkeyTabFile).toHaveBeenCalledWith(tab, 'A');
    await expect(handlers.get(IPC.FILE.SAVE_HOLDING_TANK_TAB)({}, ['1'], 'Tab 1')).resolves.toEqual({ success: true, data: { canceled: true } });
    expect(fileOperations.saveHoldingTankTabFile).toHaveBeenCalledWith(['1'], 'Tab 1');
  });

  it('loads through the file operations and returns their result', async () => {
    await expect(handlers.get(IPC.FILE.LOAD_HOTKEY_TAB)({})).resolves.toEqual({ success: true, data: { hotkeys: { f1: '1' }, tabName: null } });
    await expect(handlers.get(IPC.FILE.LOAD_HOLDING_TANK_TAB)({})).resolves.toEqual({ success: false, error: 'bad' });
  });

  it('is exposed in the preload under fileOperations, and the old push events are gone', () => {
    const source = fs.readFileSync('src/preload/modules/secure-api-exposer.cjs', 'utf8');
    expect(source).toContain('saveHotkeyTab: (tab, label) => ipcRenderer.invoke(IPC.FILE.SAVE_HOTKEY_TAB, tab, label)');
    expect(source).toContain('saveHoldingTankTab: (songIds, label) => ipcRenderer.invoke(IPC.FILE.SAVE_HOLDING_TANK_TAB, songIds, label)');
    expect(source).toContain('loadHotkeyTab: () => ipcRenderer.invoke(IPC.FILE.LOAD_HOTKEY_TAB)');
    expect(source).toContain('loadHoldingTankTab: () => ipcRenderer.invoke(IPC.FILE.LOAD_HOLDING_TANK_TAB)');
    expect(source).not.toContain('fkey_load');
    expect(source).not.toContain('holding_tank_load');
  });
});
