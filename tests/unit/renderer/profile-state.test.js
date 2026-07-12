import { beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.window = {
  debugLog: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
};

const { flushProfileState, loadProfileState, saveProfileState } = await import('../../../src/renderer/modules/profile-state/index.js');

describe('profile state restoration', () => {
  beforeEach(() => {
    window.isRestoringProfileState = false;
    window.secureElectronAPI = {
      profile: {
        getCurrent: vi.fn().mockResolvedValue({ success: true, profile: 'Default User' }),
        loadState: vi.fn(),
        saveState: vi.fn().mockResolvedValue({ success: true })
      }
    };
  });

  it('restores empty collections so custom tab names are not discarded', async () => {
    window.secureElectronAPI.profile.loadState.mockResolvedValue({
      success: true,
      loaded: true,
      data: JSON.stringify({
        version: '1.0.0',
        hotkeys: [{ tabNumber: 2, tabName: 'Act Two', hotkeys: {} }],
        holdingTank: [{ tabNumber: 3, tabName: 'Standby', songIds: [] }]
      })
    });
    const hotkeysModule = { restoreHotkeySnapshot: vi.fn().mockResolvedValue([]) };
    const holdingTankModule = { restoreHoldingTankSnapshot: vi.fn().mockResolvedValue([]) };

    const result = await loadProfileState({ hotkeysModule, holdingTankModule });

    expect(result).toEqual({ success: true, loaded: true });
    expect(hotkeysModule.restoreHotkeySnapshot).toHaveBeenCalledOnce();
    expect(holdingTankModule.restoreHoldingTankSnapshot).toHaveBeenCalledOnce();
    expect(window.isRestoringProfileState).toBe(true);
  });

  it('flushes a pending debounced save for a lifecycle transition', async () => {
    const pending = saveProfileState();
    const flushed = await flushProfileState();

    expect(flushed).toEqual({ success: true });
    await expect(pending).resolves.toEqual({ success: true });
    expect(window.secureElectronAPI.profile.saveState).toHaveBeenCalledOnce();
  });
});
