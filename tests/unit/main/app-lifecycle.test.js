import { describe, expect, it, vi } from 'vitest';
import { createAppLifecycle } from '../../../src/main/modules/app-lifecycle.js';

function createHarness(overrides = {}) {
  const handlers = {};
  const app = {
    name: 'Mx. Voice',
    getVersion: () => '1.0.0',
    on: (event, handler) => { handlers[event] = handler; },
    quit: vi.fn(),
    setAppLogsPath: vi.fn(),
    setAboutPanelOptions: vi.fn()
  };
  const dependencies = {
    app,
    BrowserWindow: { getAllWindows: () => [{}] },
    prepareWindowForClose: vi.fn(),
    createWindow: vi.fn(),
    onClosed: vi.fn(),
    debugLog: { info: vi.fn(), error: vi.fn() },
    platform: 'linux',
    environment: {},
    ...overrides
  };
  const lifecycle = createAppLifecycle(dependencies);
  lifecycle.setup();
  return { app, dependencies, handlers, lifecycle };
}

describe('app lifecycle', () => {
  it('flushes state and services before reissuing quit', async () => {
    const autoBackupTimer = { stopAutoBackupTimer: vi.fn() };
    const analytics = { trackEvent: vi.fn(), shutdown: vi.fn() };
    const { app, dependencies, handlers } = createHarness({ autoBackupTimer, analytics, appStartTime: Date.now() - 5000 });
    const event = { preventDefault: vi.fn() };

    await handlers['before-quit'](event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(dependencies.prepareWindowForClose).toHaveBeenCalledOnce();
    expect(autoBackupTimer.stopAutoBackupTimer).toHaveBeenCalledOnce();
    expect(analytics.shutdown).toHaveBeenCalledOnce();
    expect(app.quit).toHaveBeenCalledOnce();
  });

  it('does not run shutdown twice while it is in progress', async () => {
    let finishPreparation;
    const preparation = new Promise((resolve) => { finishPreparation = resolve; });
    const { handlers, dependencies } = createHarness({ prepareWindowForClose: vi.fn(() => preparation) });
    const first = handlers['before-quit']({ preventDefault: vi.fn() });
    await handlers['before-quit']({ preventDefault: vi.fn() });
    expect(dependencies.prepareWindowForClose).toHaveBeenCalledOnce();
    finishPreparation();
    await first;
  });

  it('keeps the app open on macOS when all windows close', () => {
    const { app, handlers } = createHarness({ platform: 'darwin' });
    handlers['window-all-closed']();
    expect(app.quit).not.toHaveBeenCalled();
  });
});
