import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = {};
const fakeIpcMain = {
  handle: (channel, handler) => { handlers[channel] = handler; },
};

vi.mock('electron', () => ({
  default: { ipcMain: fakeIpcMain },
}));

const { default: ipcChannels } = await import('../../../src/shared/ipc-channels.cjs');
const { register } = await import('../../../src/main/modules/ipc/analytics-handlers.js');
const { IPC } = ipcChannels;

describe('analytics IPC handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const channel of Object.keys(handlers)) delete handlers[channel];
  });

  it('persists opt-out when the analytics module is unavailable', async () => {
    const store = { set: vi.fn() };
    register({ analytics: null, store });

    const result = await handlers[IPC.ANALYTICS.SET_OPT_OUT]({}, true);

    expect(store.set).toHaveBeenCalledWith('analytics_opt_out', true);
    expect(result).toEqual({ success: true });
  });

  it('reads persisted opt-out when the analytics module is unavailable', async () => {
    const store = { get: vi.fn().mockReturnValue(true) };
    register({ analytics: null, store });

    const result = await handlers[IPC.ANALYTICS.GET_OPT_OUT_STATUS]({});

    expect(store.get).toHaveBeenCalledWith('analytics_opt_out');
    expect(result).toEqual({ success: true, value: true });
  });
});
