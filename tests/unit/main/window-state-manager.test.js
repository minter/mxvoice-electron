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

  it('gives up on a page that never flushes, and still saves the window state', async () => {
    vi.useFakeTimers();
    try {
      const window = {
        isDestroyed: () => false,
        webContents: { isDestroyed: () => false, executeJavaScript: vi.fn(() => new Promise(() => {})) },
        getBounds: () => ({ x: 1, y: 2, width: 800, height: 600 }),
        isMaximized: () => false,
        isFullScreen: () => false
      };
      const { manager, store } = createHarness({ getMainWindow: () => window, flushTimeoutMs: 50 });

      const closing = manager.prepareMainWindowForClose();
      await vi.advanceTimersByTimeAsync(50);
      await closing;

      expect(window.webContents.executeJavaScript).toHaveBeenCalled();
      expect(store.set).toHaveBeenCalledWith('window_state', expect.objectContaining({ width: 800 }));
    } finally {
      vi.useRealTimers();
    }
  });

  describe('closing the window', () => {
    function closableWindow() {
      const handlers = {};
      const window = {
        id: 1,
        isDestroyed: () => false,
        on: (event, handler) => { handlers[event] = handler; },
        close: vi.fn(() => handlers.close({ preventDefault: vi.fn() })),
        webContents: { isDestroyed: () => false, executeJavaScript: vi.fn(async () => ({ success: true })) },
        getBounds: () => ({ x: 0, y: 0, width: 800, height: 600 }),
        isMaximized: () => false,
        isFullScreen: () => false
      };
      return { window, handlers };
    }

    function setup({ answer = true, quitting = false } = {}) {
      const { window, handlers } = closableWindow();
      const confirmClose = vi.fn(async () => {
        if (answer instanceof Error) throw answer;
        return answer;
      });
      const { manager } = createHarness({ getMainWindow: () => window, confirmClose, isQuitting: () => quitting });
      manager.setupWindowStateSaving();
      const close = async () => {
        const event = { preventDefault: vi.fn() };
        await handlers.close(event);
        return event;
      };
      return { window, confirmClose, close };
    }

    it('asks first, and keeps the window open when the user cancels', async () => {
      const { window, confirmClose, close } = setup({ answer: false });
      const event = await close();
      expect(confirmClose).toHaveBeenCalledWith(window);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(window.webContents.executeJavaScript).not.toHaveBeenCalled();
      expect(window.close).not.toHaveBeenCalled();

      // Asking again next time, not stuck
      await close();
      expect(confirmClose).toHaveBeenCalledTimes(2);
    });

    it('saves state and closes once the user confirms', async () => {
      const { window, confirmClose, close } = setup({ answer: true });
      await close();
      expect(confirmClose).toHaveBeenCalledOnce();
      expect(window.webContents.executeJavaScript).toHaveBeenCalledOnce();
      expect(window.close).toHaveBeenCalledOnce();
    });

    it('does not ask during an explicit quit (Cmd-Q, File > Quit)', async () => {
      const { confirmClose, close } = setup({ quitting: true });
      const event = await close();
      expect(confirmClose).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('shows one dialog for repeated clicks while it is up', async () => {
      const { window, handlers } = closableWindow();
      let answer;
      const confirmClose = vi.fn(() => new Promise((resolve) => { answer = resolve; }));
      const { manager } = createHarness({ getMainWindow: () => window, confirmClose });
      manager.setupWindowStateSaving();
      const first = handlers.close({ preventDefault: vi.fn() });
      await handlers.close({ preventDefault: vi.fn() });
      expect(confirmClose).toHaveBeenCalledOnce();
      answer(false);
      await first;
    });

    it('closes anyway if the dialog itself fails', async () => {
      const { window, close } = setup({ answer: new Error('no dialog') });
      await close();
      expect(window.close).toHaveBeenCalledOnce();
    });
  });

  it('a close the app makes itself (update install, session end) does not ask', async () => {
    const handlers = {};
    const window = {
      id: 1,
      isDestroyed: () => false,
      on: (event, handler) => { handlers[event] = handler; },
      close: vi.fn(),
      webContents: { isDestroyed: () => false, executeJavaScript: vi.fn(async () => ({ success: true })) },
      getBounds: () => ({ x: 0, y: 0, width: 800, height: 600 }),
      isMaximized: () => false,
      isFullScreen: () => false
    };
    const confirmClose = vi.fn(async () => false);
    const { manager } = createHarness({ getMainWindow: () => window, confirmClose });
    manager.setupWindowStateSaving();

    // Until it is really happening, a close still asks
    await handlers.close({ preventDefault: vi.fn() });
    expect(confirmClose).toHaveBeenCalledOnce();

    manager.allowUnconfirmedClose();
    const event = { preventDefault: vi.fn() };
    await handlers.close(event);
    expect(confirmClose).toHaveBeenCalledOnce();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('ignores resize, maximize and fullscreen saves while another profile is being applied', async () => {
    vi.useFakeTimers();
    try {
      const handlers = {};
      const window = {
        id: 1,
        isDestroyed: () => false,
        on: (event, handler) => { handlers[event] = handler; },
        webContents: { isDestroyed: () => false },
        getBounds: () => ({ x: 0, y: 0, width: 800, height: 600 }),
        isMaximized: () => false,
        isFullScreen: () => false
      };
      const { manager, store } = createHarness({ getMainWindow: () => window });
      manager.setupWindowStateSaving();

      manager.suppressSaves(1500);
      handlers.unmaximize();
      handlers['leave-full-screen']();
      handlers.resized();
      await vi.advanceTimersByTimeAsync(600);
      expect(store.set).not.toHaveBeenCalled();

      // Once settled, the actual state is saved once, with no event needed
      await vi.advanceTimersByTimeAsync(1000);
      expect(store.set).toHaveBeenCalledWith('window_state', expect.objectContaining({ width: 800 }));

      // Later events save normally again
      store.set.mockClear();
      handlers.maximize();
      await vi.advanceTimersByTimeAsync(0);
      expect(store.set).toHaveBeenCalledWith('window_state', expect.any(Object));
    } finally {
      vi.useRealTimers();
    }
  });

  describe('ending the board session', () => {
    function sessionHarness({ answer = true } = {}) {
      const calls = [];
      const handlers = {};
      const window = {
        id: 1,
        isDestroyed: () => false,
        on: (event, handler) => { handlers[event] = handler; },
        close: vi.fn(),
        webContents: {
          isDestroyed: () => false,
          executeJavaScript: vi.fn(async () => { calls.push('flush'); return { success: true }; })
        },
        getBounds: () => ({ x: 0, y: 0, width: 800, height: 600 }),
        isMaximized: () => false,
        isFullScreen: () => false
      };
      const boardSession = {
        end: vi.fn(async (reason) => { calls.push(`end:${reason}`); }),
        handoff: vi.fn(async (reason) => { calls.push(`handoff:${reason}`); })
      };
      const store = { get: vi.fn(), set: vi.fn((key) => { if (key === 'window_state') calls.push('saveWindowState'); }) };
      const confirmClose = vi.fn(async () => answer);
      const { manager } = createHarness({ getMainWindow: () => window, store, boardSession, confirmClose });
      manager.setupWindowStateSaving();
      return { manager, handlers, calls, boardSession, confirmClose, window };
    }

    it('confirmed close flushes, then retires recovery', async () => {
      const { handlers, calls } = sessionHarness({ answer: true });
      await handlers.close({ preventDefault: vi.fn() });
      expect(calls).toEqual(['flush', 'saveWindowState', 'end:clean-exit']);
    });

    it('cancelled close retires nothing', async () => {
      const { handlers, boardSession } = sessionHarness({ answer: false });
      await handlers.close({ preventDefault: vi.fn() });
      expect(boardSession.end).not.toHaveBeenCalled();
      expect(boardSession.handoff).not.toHaveBeenCalled();
    });

    it('update-install preparation marks handoff and does not retire', async () => {
      const { manager, calls, boardSession } = sessionHarness();
      await manager.prepareMainWindowForClose({ exit: 'handoff' });
      expect(calls).toEqual(['flush', 'saveWindowState', 'handoff:update']);
      expect(boardSession.end).not.toHaveBeenCalled();
    });

    it('a switch ends the session as a switch', async () => {
      const { manager, calls } = sessionHarness();
      await manager.prepareMainWindowForClose({ exit: 'switch' });
      expect(calls).toEqual(['flush', 'saveWindowState', 'end:switch']);
    });

    it('quitting and Windows session end are clean exits', async () => {
      const { manager, handlers, boardSession } = sessionHarness();
      await manager.prepareMainWindowForClose();
      expect(boardSession.end).toHaveBeenLastCalledWith('clean-exit');
      handlers['session-end']();
      await vi.waitFor(() => expect(boardSession.end).toHaveBeenCalledTimes(2));
      expect(boardSession.end).toHaveBeenLastCalledWith('clean-exit');
    });

    it('a close whose flush failed keeps the record through the quit that follows', async () => {
      const { manager, boardSession, window } = sessionHarness();
      // The close button: the page's flush fails outright
      window.webContents.executeJavaScript.mockRejectedValueOnce(new Error('page script threw'));
      await expect(manager.prepareMainWindowForClose()).rejects.toThrow('page script threw');
      // window-all-closed → before-quit: the window is gone, a fresh preparation runs
      window.isDestroyed = () => true;
      await manager.prepareMainWindowForClose();
      expect(boardSession.end).not.toHaveBeenCalled();
    });

    it('an update handoff is marked even when the flush throws, and the quit keeps the record', async () => {
      const { manager, boardSession, window } = sessionHarness();
      window.webContents.executeJavaScript.mockRejectedValueOnce(new Error('page script threw'));
      await expect(manager.prepareMainWindowForClose({ exit: 'handoff' })).rejects.toThrow('page script threw');
      expect(boardSession.handoff).toHaveBeenCalledWith('update');
      // quitAndInstall → before-quit
      window.isDestroyed = () => true;
      await manager.prepareMainWindowForClose();
      expect(boardSession.end).not.toHaveBeenCalled();
    });

    it('a later successful flush clears the keep-the-record latch', async () => {
      const { manager, boardSession, window } = sessionHarness();
      window.webContents.executeJavaScript.mockRejectedValueOnce(new Error('page script threw'));
      await expect(manager.prepareMainWindowForClose({ exit: 'switch' })).rejects.toThrow();
      expect(boardSession.end).not.toHaveBeenCalled();
      // The reloaded page is healthy again
      await manager.prepareMainWindowForClose();
      expect(boardSession.end).toHaveBeenCalledWith('clean-exit');
    });

    it('rejects an unknown exit kind', () => {
      const { manager, boardSession } = sessionHarness();
      expect(() => manager.prepareMainWindowForClose({ exit: 'reboot' })).toThrow(/exit/);
      expect(boardSession.end).not.toHaveBeenCalled();
    });

    it('ends the session even when the window is already gone', async () => {
      const boardSession = { end: vi.fn(async () => {}), handoff: vi.fn() };
      const { manager } = createHarness({ getMainWindow: () => null, boardSession });
      await manager.prepareMainWindowForClose();
      expect(boardSession.end).toHaveBeenCalledWith('clean-exit');
    });
  });

  it('Windows session end closes without asking and saves', async () => {
    const handlers = {};
    const window = {
      id: 1,
      isDestroyed: () => false,
      on: (event, handler) => { handlers[event] = handler; },
      close: vi.fn(),
      webContents: { isDestroyed: () => false, executeJavaScript: vi.fn(async () => ({ success: true })) },
      getBounds: () => ({ x: 0, y: 0, width: 800, height: 600 }),
      isMaximized: () => false,
      isFullScreen: () => false
    };
    const confirmClose = vi.fn(async () => false);
    const { manager } = createHarness({ getMainWindow: () => window, confirmClose });
    manager.setupWindowStateSaving();

    handlers['session-end']();
    expect(window.webContents.executeJavaScript).toHaveBeenCalledOnce();
    const event = { preventDefault: vi.fn() };
    await handlers.close(event);
    expect(confirmClose).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
