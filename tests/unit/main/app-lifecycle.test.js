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
    prepareWindowForClose: vi.fn(),
    onClosed: vi.fn(),
    debugLog: { info: vi.fn(), error: vi.fn() },
    platform: 'linux',
    ...overrides
  };
  const lifecycle = createAppLifecycle(dependencies);
  lifecycle.setup();
  return { app, dependencies, handlers, lifecycle };
}

describe('app lifecycle', () => {
  it('flushes state and services before reissuing quit', async () => {
    const autoBackupTimer = { stopAutoBackupTimer: vi.fn() };
    const analytics = { endSession: vi.fn() };
    const { app, dependencies, handlers } = createHarness({ autoBackupTimer, analytics, appStartTime: Date.now() - 5000 });
    const event = { preventDefault: vi.fn() };

    await handlers['before-quit'](event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(dependencies.prepareWindowForClose).toHaveBeenCalledOnce();
    expect(autoBackupTimer.stopAutoBackupTimer).toHaveBeenCalledOnce();
    expect(analytics.endSession).toHaveBeenCalledOnce();
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

  it.each(['darwin', 'win32', 'linux'])('quits when the last window closes on %s', (platform) => {
    const { app, handlers } = createHarness({ platform });
    handlers['window-all-closed']();
    expect(app.quit).toHaveBeenCalledOnce();
  });

  it('has no windowless state to reopen from the Dock', () => {
    const { handlers } = createHarness({ platform: 'darwin' });
    expect(handlers.activate).toBeUndefined();
  });

  it('sets the macOS About panel and the logs path', () => {
    const { app } = createHarness({ platform: 'darwin' });
    expect(app.setAppLogsPath).toHaveBeenCalled();
    expect(app.setAboutPanelOptions).toHaveBeenCalledWith(expect.objectContaining({ applicationName: 'Mx. Voice' }));
  });
});
