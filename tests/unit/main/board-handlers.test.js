import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = {};
const ipcMain = { handle: (channel, handler) => { handlers[channel] = handler; } };

vi.mock('electron', () => ({ default: { ipcMain }, ipcMain }));
const registeredProfiles = new Set(['Alice', 'Bob']);
vi.mock('../../../src/main/modules/profile-manager.js', () => ({
  profileExists: (name) => registeredProfiles.has(name),
}));

const UUID = '0b6f6f2e-8a51-4d0e-9b8e-3d0c1f2a7e44';

const { register } = await import('../../../src/main/modules/ipc/board-handlers.js');

function setup(overrides = {}) {
  const boardSession = {
    open: vi.fn(async () => ({ doc: {}, board: {}, recovery: null, generation: 1 })),
    startEmpty: vi.fn(async () => ({ layout: {}, generation: 1 })),
    resolveRecovery: vi.fn(async () => ({ layout: { hotkeys: [] } })),
    reportReady: vi.fn(),
    saveRecovery: vi.fn(async () => ({})),
    state: vi.fn(() => ({ profile: 'Alice', status: 'ready', doc: null, generation: 1 })),
    activate: vi.fn(async () => ({ layout: {}, generation: 2 })),
    revert: vi.fn(async () => ({ layout: {}, generation: 2 })),
    updateActive: vi.fn(async () => undefined),
    createBoard: vi.fn(async () => ({ id: UUID, name: 'New' })),
    renameBoard: vi.fn(async () => ({ id: UUID, name: 'Renamed' })),
    deleteBoard: vi.fn(async () => ({ activeChanged: false })),
    listImportable: vi.fn(async () => [{ profile: 'Bob', boards: [] }]),
    importBoard: vi.fn(async () => ({ layout: {}, generation: 2 })),
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

  it('passes board mutations through to the session', async () => {
    const { boardSession } = setup();
    const layout = { hotkeys: [] };

    await expect(handlers['board:activate']({}, UUID)).resolves.toEqual({ success: true, data: { layout: {}, generation: 2 } });
    expect(boardSession.activate).toHaveBeenCalledWith(UUID);
    await expect(handlers['board:revert']({})).resolves.toEqual({ success: true, data: { layout: {}, generation: 2 } });
    await expect(handlers['board:update-active']({}, layout)).resolves.toEqual({ success: true, data: null });
    expect(boardSession.updateActive).toHaveBeenCalledWith(layout);
    await expect(handlers['board:create']({}, 'New', layout)).resolves.toEqual({ success: true, data: { id: UUID, name: 'New' } });
    expect(boardSession.createBoard).toHaveBeenCalledWith('New', layout);
    await expect(handlers['board:rename']({}, UUID, 'Renamed')).resolves.toMatchObject({ success: true });
    expect(boardSession.renameBoard).toHaveBeenCalledWith(UUID, 'Renamed');
    await expect(handlers['board:delete']({}, UUID)).resolves.toEqual({ success: true, data: { activeChanged: false } });
    expect(boardSession.deleteBoard).toHaveBeenCalledWith(UUID);
    await expect(handlers['board:list-importable']({})).resolves.toEqual({ success: true, data: [{ profile: 'Bob', boards: [] }] });
    await expect(handlers['board:import']({}, 'Bob', UUID)).resolves.toEqual({ success: true, data: { layout: {}, generation: 2 } });
    expect(boardSession.importBoard).toHaveBeenCalledWith('Bob', UUID);

    // Session errors come back wrapped, with the exact message
    boardSession.renameBoard.mockRejectedValueOnce(new Error('A board with this name already exists.'));
    await expect(handlers['board:rename']({}, UUID, 'Dup')).resolves.toEqual({
      success: false, error: 'A board with this name already exists.',
    });
  });

  it('rejects an unregistered profile on IMPORT', async () => {
    const { boardSession } = setup();
    for (const profile of ['Mallory', '../Bob', 42, undefined]) {
      await expect(handlers['board:import']({}, profile, UUID)).resolves.toMatchObject({ success: false });
    }
    expect(boardSession.importBoard).not.toHaveBeenCalled();
  });

  it('rejects a board id that is not a UUID', async () => {
    const { boardSession } = setup();
    for (const id of ['../../x', '', 42, null, `${UUID}x`, UUID.toUpperCase()]) {
      await expect(handlers['board:activate']({}, id)).resolves.toMatchObject({ success: false });
      await expect(handlers['board:rename']({}, id, 'Name')).resolves.toMatchObject({ success: false });
      await expect(handlers['board:delete']({}, id)).resolves.toMatchObject({ success: false });
      await expect(handlers['board:import']({}, 'Bob', id)).resolves.toMatchObject({ success: false });
    }
    expect(boardSession.activate).not.toHaveBeenCalled();
    expect(boardSession.renameBoard).not.toHaveBeenCalled();
    expect(boardSession.deleteBoard).not.toHaveBeenCalled();
    expect(boardSession.importBoard).not.toHaveBeenCalled();
  });
});
