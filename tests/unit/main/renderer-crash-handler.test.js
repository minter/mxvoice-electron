import { describe, expect, it, vi } from 'vitest';
import { createRendererGoneHandler } from '../../../src/main/modules/renderer-crash-handler.js';
import { createShowSession } from '../../../src/main/modules/show-session.js';
import { createWindowStateManager } from '../../../src/main/modules/window-state-manager.js';
import { createDocument, normalizeLayout } from '../../../src/main/modules/show-document.js';

const MESSAGE = "Mx. Voice's window stopped working. Reload it and restore the show in progress?";
const saved = normalizeLayout({ hotkeys: [{ tabNumber: 1, hotkeys: { f1: '1' } }] });
// The show in progress differs from the saved show, so it has a record
const layout = normalizeLayout({ hotkeys: [{ tabNumber: 1, hotkeys: { f1: '9' } }] });

function memoryRecoveryStore() {
  const records = new Map();
  return {
    records,
    write: vi.fn(async (profile, { showId, layout: l }) => {
      records.set(profile, { version: 1, showId, savedAt: Date.now(), handoff: null, layout: l });
    }),
    read: vi.fn(async (profile) => records.get(profile) ?? null),
    markHandoff: vi.fn(async (profile, reason) => {
      const record = records.get(profile);
      if (!record) return false;
      records.set(profile, { ...record, handoff: reason });
      return true;
    }),
    retire: vi.fn(async (profile) => { records.delete(profile); }),
    clearAll: vi.fn(async () => { records.clear(); })
  };
}

function makeWindow({ destroyed = false } = {}) {
  return {
    isDestroyed: () => destroyed,
    webContents: {
      isDestroyed: () => false,
      // A crashed page never answers the close-time flush
      executeJavaScript: vi.fn(() => new Promise(() => {})),
      reload: vi.fn()
    },
    getBounds: () => ({ x: 0, y: 0, width: 800, height: 600 }),
    isMaximized: () => false,
    isFullScreen: () => false
  };
}

function setup({ response = 0, window = makeWindow() } = {}) {
  const dialog = { showMessageBox: vi.fn(async () => ({ response })) };
  const app = { quit: vi.fn() };
  const showSession = { rendererGone: vi.fn() };
  const debugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const handler = createRendererGoneHandler({ showSession, dialog, getMainWindow: () => window, app, debugLog });
  return { handler, dialog, app, showSession, window, debugLog };
}

describe('renderer crash handler', () => {
  it.each([[0, 'reload'], [1, 'quit']])('waits for the handoff write before acting on %s', async (response) => {
    const { handler, showSession, window, app } = setup({ response });
    let release;
    showSession.rendererGone.mockReturnValue(new Promise((resolve) => { release = resolve; }));

    const done = handler({}, { reason: 'crashed' });
    await new Promise((r) => setTimeout(r, 10));
    expect(window.webContents.reload).not.toHaveBeenCalled();
    expect(app.quit).not.toHaveBeenCalled();

    release();
    await done;
    expect(window.webContents.reload).toHaveBeenCalledTimes(response === 0 ? 1 : 0);
    expect(app.quit).toHaveBeenCalledTimes(response === 0 ? 0 : 1);
  });

  it('renderer crash marks handoff and the following quit keeps the record', async () => {
    const recoveryStore = memoryRecoveryStore();
    const doc = createDocument(saved, { now: Date.now(), newId: () => 'show-1' });
    const showSession = createShowSession({
      showStore: { load: vi.fn(async () => ({ doc, source: 'shows' })) },
      recoveryStore,
      getCurrentProfile: () => 'Alice'
    });
    const opened = await showSession.open();
    showSession.reportReady(opened.generation, true);
    await showSession.saveRecovery(layout);

    const window = makeWindow();
    const app = { quit: vi.fn() };
    const dialog = { showMessageBox: vi.fn(async () => ({ response: 1 })) };
    const handler = createRendererGoneHandler({ showSession, dialog, getMainWindow: () => window, app });
    await handler({}, { reason: 'crashed', exitCode: 11 });
    expect(app.quit).toHaveBeenCalledOnce();

    // The quit that follows is a clean exit (before-quit)
    const manager = createWindowStateManager({
      getMainWindow: () => window,
      store: { get: vi.fn(), set: vi.fn() },
      screen: { getDisplayNearestPoint: () => ({ id: 1 }) },
      getCurrentProfile: () => null,
      isQuitting: () => true,
      showSession,
      flushTimeoutMs: 5
    });
    await manager.prepareMainWindowForClose();

    expect(recoveryStore.markHandoff).toHaveBeenCalledWith('Alice', 'renderer-crash');
    expect(recoveryStore.retire).not.toHaveBeenCalled();
    expect(recoveryStore.records.get('Alice')).toMatchObject({ handoff: 'renderer-crash', layout });
  });

  it('Reload reloads the page; Quit quits', async () => {
    const reload = setup({ response: 0 });
    await reload.handler({}, { reason: 'crashed' });
    expect(reload.showSession.rendererGone).toHaveBeenCalledOnce();
    expect(reload.dialog.showMessageBox).toHaveBeenCalledWith(reload.window, expect.objectContaining({
      message: MESSAGE,
      buttons: ['Reload', 'Quit'],
      defaultId: 0
    }));
    expect(reload.window.webContents.reload).toHaveBeenCalledOnce();
    expect(reload.app.quit).not.toHaveBeenCalled();

    const quit = setup({ response: 1 });
    await quit.handler({}, { reason: 'oom' });
    expect(quit.app.quit).toHaveBeenCalledOnce();
    expect(quit.window.webContents.reload).not.toHaveBeenCalled();
  });

  it('in test mode answers from the E2E seam instead of a native dialog', async () => {
    const prev = process.env.APP_TEST_MODE;
    process.env.APP_TEST_MODE = '1';
    try {
      globalThis.__e2eRendererCrashPrompts = 0;
      const reload = setup();
      await reload.handler({}, { reason: 'crashed' });
      expect(reload.dialog.showMessageBox).not.toHaveBeenCalled();
      expect(reload.window.webContents.reload).toHaveBeenCalledOnce();

      globalThis.__e2eRendererCrashAnswer = 'quit';
      const quit = setup();
      await quit.handler({}, { reason: 'crashed' });
      expect(quit.app.quit).toHaveBeenCalledOnce();
      expect(globalThis.__e2eRendererCrashPrompts).toBe(2);
    } finally {
      if (prev === undefined) delete process.env.APP_TEST_MODE;
      else process.env.APP_TEST_MODE = prev;
      delete globalThis.__e2eRendererCrashAnswer;
      delete globalThis.__e2eRendererCrashPrompts;
    }
  });

  it('marks the handoff before asking', async () => {
    const ctx = setup();
    ctx.dialog.showMessageBox.mockImplementation(async () => {
      expect(ctx.showSession.rendererGone).toHaveBeenCalled();
      return { response: 0 };
    });
    await ctx.handler({}, { reason: 'killed' });
    expect(ctx.dialog.showMessageBox).toHaveBeenCalledOnce();
  });

  it('ignores a normal renderer exit', async () => {
    const ctx = setup();
    await ctx.handler({}, { reason: 'clean-exit' });
    expect(ctx.showSession.rendererGone).not.toHaveBeenCalled();
    expect(ctx.dialog.showMessageBox).not.toHaveBeenCalled();
  });

  it('marks the handoff but asks nothing when the window is gone', async () => {
    const ctx = setup({ window: makeWindow({ destroyed: true }) });
    await ctx.handler({}, { reason: 'crashed' });
    expect(ctx.showSession.rendererGone).toHaveBeenCalledOnce();
    expect(ctx.dialog.showMessageBox).not.toHaveBeenCalled();

    const none = setup({ window: null });
    await none.handler({}, { reason: 'crashed' });
    expect(none.dialog.showMessageBox).not.toHaveBeenCalled();
  });

  it('quits if the dialog fails', async () => {
    const ctx = setup();
    ctx.dialog.showMessageBox.mockRejectedValue(new Error('no dialog'));
    await ctx.handler({}, { reason: 'crashed' });
    expect(ctx.app.quit).toHaveBeenCalledOnce();
    expect(ctx.debugLog.error).toHaveBeenCalled();
  });
});
