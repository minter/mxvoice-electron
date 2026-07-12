import { beforeEach, describe, expect, it, vi } from 'vitest';

const listeners = {};
globalThis.window = {
  addEventListener: vi.fn((name, handler) => { listeners[name] = handler; }),
  secureElectronAPI: {}
};
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
globalThis.document = {
  getElementById: vi.fn(() => null),
  createElement: vi.fn(() => ({ getContext: vi.fn(() => null) }))
};

const { SharedStateSetup } = await import('../../../src/renderer/modules/app-initialization/shared-state-setup.js');
const { EnvironmentSetup } = await import('../../../src/renderer/modules/app-initialization/environment-setup.js');

describe('renderer initialization contracts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('initializes shared state defaults and exposes lazy waveform creation', async () => {
    const setup = new SharedStateSetup();
    await expect(setup.initializeSharedState()).resolves.toBe(true);
    const state = setup.getSharedStateInstance();
    expect(setup.isInitialized()).toBe(true);
    expect(state.get('fontSize')).toBe(11);
    expect(state.get('categories')).toEqual({});
    expect(state.get('createWaveSurfer')()).toBeNull();
  });

  it('registers global error handlers and reports capability flags', async () => {
    const logger = { logInfo: vi.fn(), logDebug: vi.fn(), logWarn: vi.fn(), logError: vi.fn() };
    const setup = new EnvironmentSetup(logger);
    await expect(setup.initializeEnvironment({ performanceMonitoring: false })).resolves.toBe(true);
    expect(window.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(window.addEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    listeners.error({ message: 'boom', filename: 'app.js', lineno: 1, colno: 2 });
    expect(logger.logError).toHaveBeenCalledWith('Global error caught', expect.objectContaining({ message: 'boom' }));
    expect(setup.checkSystemCapabilities()).toMatchObject({ electronAPI: true, webGL: false });
  });
});
