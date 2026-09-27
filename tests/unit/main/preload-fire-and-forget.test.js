import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

// Fire-and-forget IPC calls must never reject: an unhandled rejection feeds the
// renderer's error handler, which calls analytics again and loops.
const require = createRequire(import.meta.url);
const invoke = vi.fn();
require.cache[require.resolve('electron')] = {
  exports: { contextBridge: {}, ipcRenderer: { invoke, on: vi.fn(), removeListener: vi.fn() }, webUtils: {} },
};
const { secureElectronAPI } = require('../../../src/preload/modules/secure-api-exposer.cjs');

describe('preload fire-and-forget IPC calls', () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockRejectedValue(new Error("No handler registered for 'analytics:track-event'"));
  });

  it('analytics.trackEvent resolves even when the handler is missing', async () => {
    await expect(secureElectronAPI.analytics.trackEvent('song_played', {})).resolves.toBeUndefined();
  });

  it('logs.write resolves even when the handler is missing', async () => {
    await expect(secureElectronAPI.logs.write('INFO', 'hello')).resolves.toBeUndefined();
  });

  it('still forwards the event over IPC', async () => {
    invoke.mockResolvedValue({ success: true });
    await secureElectronAPI.analytics.trackEvent('song_played', { trigger_method: 'hotkey' });
    expect(invoke).toHaveBeenCalledWith(expect.any(String), 'song_played', { trigger_method: 'hotkey' });
  });
});
