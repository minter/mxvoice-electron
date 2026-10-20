import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = {};
const ipcMain = { handle: (channel, handler) => { handlers[channel] = handler; } };

vi.mock('electron', () => ({ default: { ipcMain }, ipcMain }));

const { register } = await import('../../../src/main/modules/ipc/board-handlers.js');

function setup(overrides = {}) {
  const boardSession = {
    open: vi.fn(async () => ({ doc: {}, board: {}, recovery: null, generation: 1 })),
    startEmpty: vi.fn(async () => ({ layout: {}, generation: 1 })),
    resolveRecovery: vi.fn(async () => ({ layout: { hotkeys: [] } })),
    reportReady: vi.fn(),
    saveRecovery: vi.fn(async () => ({})),
    state: vi.fn(() => ({ profile: 'Alice', status: 'ready', doc: null, generation: 1 })),
    ...overrides,
  };
  register({ boardSession, debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } });
  return { boardSession };
}

describe('board IPC handlers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('wraps results as { success, data }', async () => {
    const { boardSession } = setup();

    await expect(handlers['board:open']({})).resolves.toEqual({
      success: true, data: { doc: {}, board: {}, recovery: null, generation: 1 },
    });
    await expect(handlers['board:start-empty']({})).resolves.toEqual({
      success: true, data: { layout: {}, generation: 1 },
    });
    await expect(handlers['board:resolve-recovery']({}, 'restore')).resolves.toEqual({
      success: true, data: { layout: { hotkeys: [] } },
    });
    expect(boardSession.resolveRecovery).toHaveBeenCalledWith('restore');
    await expect(handlers['board:report-ready']({}, 3, true)).resolves.toEqual({ success: true, data: null });
    expect(boardSession.reportReady).toHaveBeenCalledWith(3, true);
    await expect(handlers['board:get-state']({})).resolves.toEqual({
      success: true, data: { profile: 'Alice', status: 'ready', doc: null, generation: 1 },
    });

    boardSession.open.mockRejectedValueOnce(new Error('boom'));
    await expect(handlers['board:open']({})).resolves.toEqual({ success: false, error: 'boom' });
    boardSession.resolveRecovery.mockRejectedValueOnce(new Error('Invalid recovery choice: bogus'));
    await expect(handlers['board:resolve-recovery']({}, 'bogus')).resolves.toEqual({
      success: false, error: 'Invalid recovery choice: bogus',
    });
  });

  it('SAVE_RECOVERY never takes a profile name from the renderer', async () => {
    const { boardSession } = setup();
    const layout = { hotkeys: [] };

    await expect(handlers['board:save-recovery']({}, layout, 'Bob', { profile: 'Bob' })).resolves.toEqual({
      success: true, data: {},
    });
    expect(boardSession.saveRecovery).toHaveBeenCalledTimes(1);
    expect(boardSession.saveRecovery.mock.calls[0]).toEqual([layout]);
  });

  it('reports an unavailable session instead of throwing', async () => {
    register({ debugLog: null });
    await expect(handlers['board:open']({})).resolves.toMatchObject({ success: false });
  });
});
