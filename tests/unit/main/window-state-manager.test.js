import { describe, expect, it, vi } from 'vitest';
import { createWindowStateManager } from '../../../src/main/modules/window-state-manager.js';

function createHarness(overrides = {}) {
  const store = { get: vi.fn(), set: vi.fn() };
  const profileManager = {
    loadProfilePreferences: vi.fn().mockResolvedValue({}),
    saveProfilePreferences: vi.fn()
  };
  const manager = createWindowStateManager({
    mainWindow: null,
    store,
    debugLog: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    screen: { getDisplayNearestPoint: () => ({ id: 2, label: 'Stage' }) },
    profileManager,
    getCurrentProfile: () => null,
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    isQuitting: () => false,
    ...overrides
  });
  return { manager, profileManager, store };
}

describe('window state manager', () => {
  it('saves complete window state to the global store', async () => {
    const { manager, store } = createHarness();
    const window = {
      isDestroyed: () => false,
      getBounds: () => ({ x: 10, y: 20, width: 1200, height: 800 }),
      isMaximized: () => true,
      isFullScreen: () => false
    };

    await manager.saveWindowState(window);
    expect(store.set).toHaveBeenCalledWith('window_state', expect.objectContaining({
      width: 1200,
      height: 800,
      displayId: 2,
      isMaximized: true
    }));
  });

  it('prefers profile-specific window state', async () => {
    const profileManager = {
      loadProfilePreferences: vi.fn().mockResolvedValue({ window_state: { width: 900 } }),
      saveProfilePreferences: vi.fn()
    };
    const { manager } = createHarness({ profileManager });
    await expect(manager.loadWindowState(null, 'Show Profile')).resolves.toEqual({ width: 900 });
  });

  it('falls back to global state when the profile has no state', async () => {
    const { manager, store } = createHarness();
    store.get.mockReturnValue({ width: 700 });
    await expect(manager.loadWindowState(store, 'Show Profile')).resolves.toEqual({ width: 700 });
  });
});
