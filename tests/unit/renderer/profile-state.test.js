import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.window = {
  debugLog: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
};

const profileState = await import('../../../src/renderer/modules/profile-state/index.js');
const { extractLayout, flushProfileState, saveProfileState } = profileState;

function activeTabs(hotkeyHref, holdingTankHref) {
  const links = { '#hotkey_tabs': hotkeyHref, '#holding_tank_tabs': holdingTankHref };
  return {
    querySelector: (selector) => {
      const href = links[selector.split(' ')[0]];
      return href ? { getAttribute: () => href } : null;
    }
  };
}

describe('profile state writes the crash-recovery record', () => {
  beforeEach(() => {
    window.isRestoringProfileState = false;
    window.secureElectronAPI = {
      shows: { saveRecovery: vi.fn().mockResolvedValue({ success: true, data: {} }) }
    };
    profileState.initializeProfileState({
      hotkeysModule: { getHotkeySnapshot: () => [{ tabNumber: 1, tabName: 'Act One', hotkeys: { f1: '5' } }] },
      holdingTankModule: { getHoldingTankSnapshot: () => [{ tabNumber: 1, tabName: null, songIds: ['9'] }] }
    });
  });

  afterEach(() => { delete globalThis.document; });

  it('flushes a pending debounced save for a lifecycle transition', async () => {
    const pending = saveProfileState();
    const flushed = await flushProfileState();

    expect(flushed).toEqual({ success: true });
    await expect(pending).resolves.toEqual({ success: true });
    expect(window.secureElectronAPI.shows.saveRecovery).toHaveBeenCalledOnce();
    expect(window.secureElectronAPI.shows.saveRecovery).toHaveBeenCalledWith({
      hotkeys: [{ tabNumber: 1, tabName: 'Act One', hotkeys: { f1: '5' } }],
      holdingTank: [{ tabNumber: 1, tabName: null, songIds: ['9'] }],
      selected: { hotkeyTab: 1, holdingTankTab: 1 }
    });
  });

  it('a skipped or retired recovery save is still a success', async () => {
    window.secureElectronAPI.shows.saveRecovery.mockResolvedValueOnce({ success: true, data: { skipped: true } });
    await expect(flushProfileState()).resolves.toEqual({ success: true });
    window.secureElectronAPI.shows.saveRecovery.mockResolvedValueOnce({ success: true, data: { retired: true } });
    await expect(flushProfileState()).resolves.toEqual({ success: true });
  });

  it('reports a failed recovery write', async () => {
    window.secureElectronAPI.shows.saveRecovery.mockResolvedValueOnce({ success: false, error: 'disk full' });
    await expect(flushProfileState()).resolves.toEqual({ success: false, error: 'disk full' });
  });

  it('does not write while the restoration lock is held', async () => {
    window.isRestoringProfileState = true;
    await expect(flushProfileState()).resolves.toMatchObject({ success: false, skipped: true });
    expect(window.secureElectronAPI.shows.saveRecovery).not.toHaveBeenCalled();
  });

  it('extractLayout reads the selected tabs from the active tab links', () => {
    globalThis.document = activeTabs('#hotkeys_list_3', '#holding_tank_5');
    expect(extractLayout().selected).toEqual({ hotkeyTab: 3, holdingTankTab: 5 });

    globalThis.document = activeTabs('#hotkeys_list_9', null);
    expect(extractLayout().selected).toEqual({ hotkeyTab: 1, holdingTankTab: 1 });
  });
});
