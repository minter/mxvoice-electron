import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = {};
const ipcMain = { handle: (channel, handler) => { handlers[channel] = handler; } };

vi.mock('electron', () => ({ default: { ipcMain }, ipcMain }));
// Same `in` lookup as the real profileExists, so inherited names pass it
const registry = { Alice: { name: 'Alice' }, Bob: { name: 'Bob' } };
vi.mock('../../../src/main/modules/profile-manager.js', () => ({
  profileExists: (name) => name in registry,
}));

const UUID = '0b6f6f2e-8a51-4d0e-9b8e-3d0c1f2a7e44';

const { register } = await import('../../../src/main/modules/ipc/show-handlers.js');
const { createShowSession } = await import('../../../src/main/modules/show-session.js');
const { createDocument } = await import('../../../src/main/modules/show-document.js');

function setup(overrides = {}) {
  const showSession = {
    open: vi.fn(async () => ({ doc: {}, show: {}, recovery: null, generation: 1 })),
    startEmpty: vi.fn(async () => ({ layout: {}, generation: 1 })),
    resolveRecovery: vi.fn(async () => ({ layout: { hotkeys: [] } })),
    reportReady: vi.fn(),
    saveRecovery: vi.fn(async () => ({})),
    state: vi.fn(() => ({ profile: 'Alice', status: 'ready', doc: null, generation: 1 })),
    activate: vi.fn(async () => ({ layout: {}, generation: 2 })),
    revert: vi.fn(async () => ({ layout: {}, generation: 2 })),
    updateActive: vi.fn(async () => undefined),
    createShow: vi.fn(async () => ({ id: UUID, name: 'New' })),
    renameShow: vi.fn(async () => ({ id: UUID, name: 'Renamed' })),
    deleteShow: vi.fn(async () => ({ activeChanged: false })),
    listImportable: vi.fn(async () => [{ profile: 'Bob', shows: [] }]),
    importShow: vi.fn(async () => ({ layout: {}, generation: 2 })),
    ...overrides,
  };
  register({ showSession, debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } });
  return { showSession };
}

describe('show IPC handlers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('report-ready rejects dropped ids that are not a short list of numeric strings', async () => {
    const { showSession } = setup();
    for (const droppedIds of ['12', [12], ['12', 'x'], ['1;DROP'], Array.from({ length: 10001 }, (_, i) => String(i))]) {
      const result = await handlers['show:report-ready']({}, 3, true, { droppedIds });
      expect(result).toMatchObject({ success: false, error: 'Invalid dropped song ids' });
    }
    expect(showSession.reportReady).not.toHaveBeenCalled();
  });

  it('wraps results as { success, data }', async () => {
    const { showSession } = setup();

    await expect(handlers['show:open']({})).resolves.toEqual({
      success: true, data: { doc: {}, show: {}, recovery: null, generation: 1 },
    });
    await expect(handlers['show:start-empty']({})).resolves.toEqual({
      success: true, data: { layout: {}, generation: 1 },
    });
    await expect(handlers['show:resolve-recovery']({}, 'restore')).resolves.toEqual({
      success: true, data: { layout: { hotkeys: [] } },
    });
    expect(showSession.resolveRecovery).toHaveBeenCalledWith('restore');
    await expect(handlers['show:report-ready']({}, 3, true)).resolves.toEqual({ success: true, data: null });
    expect(showSession.reportReady).toHaveBeenCalledWith(3, true, { droppedIds: [] });
    await handlers['show:report-ready']({}, 4, true, { droppedIds: ['12', '7'] });
    expect(showSession.reportReady).toHaveBeenLastCalledWith(4, true, { droppedIds: ['12', '7'] });
    await expect(handlers['show:get-state']({})).resolves.toEqual({
      success: true, data: { profile: 'Alice', status: 'ready', doc: null, generation: 1 },
    });

    showSession.open.mockRejectedValueOnce(new Error('boom'));
    await expect(handlers['show:open']({})).resolves.toEqual({ success: false, error: 'boom' });
    showSession.resolveRecovery.mockRejectedValueOnce(new Error('Invalid recovery choice: bogus'));
    await expect(handlers['show:resolve-recovery']({}, 'bogus')).resolves.toEqual({
      success: false, error: 'Invalid recovery choice: bogus',
    });
  });

  it('SAVE_RECOVERY never takes a profile name from the renderer', async () => {
    const { showSession } = setup();
    const layout = { hotkeys: [] };

    await expect(handlers['show:save-recovery']({}, layout, 'Bob', { profile: 'Bob' })).resolves.toEqual({
      success: true, data: {},
    });
    expect(showSession.saveRecovery).toHaveBeenCalledTimes(1);
    expect(showSession.saveRecovery.mock.calls[0]).toEqual([layout]);
  });

  it('reports an unavailable session instead of throwing', async () => {
    register({ debugLog: null });
    await expect(handlers['show:open']({})).resolves.toMatchObject({ success: false });
  });

  it('passes show mutations through to the session', async () => {
    const { showSession } = setup();
    const layout = { hotkeys: [] };

    await expect(handlers['show:activate']({}, UUID)).resolves.toEqual({ success: true, data: { layout: {}, generation: 2 } });
    expect(showSession.activate).toHaveBeenCalledWith(UUID);
    await expect(handlers['show:revert']({})).resolves.toEqual({ success: true, data: { layout: {}, generation: 2 } });
    await expect(handlers['show:update-active']({}, layout)).resolves.toEqual({ success: true, data: null });
    expect(showSession.updateActive).toHaveBeenCalledWith(layout);
    await expect(handlers['show:create']({}, 'New', layout)).resolves.toEqual({ success: true, data: { id: UUID, name: 'New' } });
    expect(showSession.createShow).toHaveBeenCalledWith('New', layout);
    await expect(handlers['show:rename']({}, UUID, 'Renamed')).resolves.toMatchObject({ success: true });
    expect(showSession.renameShow).toHaveBeenCalledWith(UUID, 'Renamed');
    await expect(handlers['show:delete']({}, UUID)).resolves.toEqual({ success: true, data: { activeChanged: false } });
    expect(showSession.deleteShow).toHaveBeenCalledWith(UUID);
    await expect(handlers['show:list-importable']({})).resolves.toEqual({ success: true, data: [{ profile: 'Bob', shows: [] }] });
    await expect(handlers['show:import']({}, 'Bob', UUID)).resolves.toEqual({ success: true, data: { layout: {}, generation: 2 } });
    expect(showSession.importShow).toHaveBeenCalledWith('Bob', UUID);

    // Session errors come back wrapped, with the exact message
    showSession.renameShow.mockRejectedValueOnce(new Error('A show with this name already exists.'));
    await expect(handlers['show:rename']({}, UUID, 'Dup')).resolves.toEqual({
      success: false, error: 'A show with this name already exists.',
    });
    // A name validation error also carries its code
    showSession.createShow.mockRejectedValueOnce(
      Object.assign(new Error('Enter a name for the show.'), { code: 'invalid-name' })
    );
    await expect(handlers['show:create']({}, ' ', {})).resolves.toEqual({
      success: false, error: 'Enter a name for the show.', code: 'invalid-name',
    });
    // Other codes are not passed on
    showSession.revert.mockRejectedValueOnce(Object.assign(new Error('disk full'), { code: 'ENOSPC' }));
    await expect(handlers['show:revert']({})).resolves.toEqual({ success: false, error: 'disk full' });
  });

  it('rejects an unregistered profile on IMPORT', async () => {
    const { showSession } = setup();
    for (const profile of ['Mallory', '../Bob', 42, undefined]) {
      await expect(handlers['show:import']({}, profile, UUID)).resolves.toMatchObject({ success: false });
    }
    expect(showSession.importShow).not.toHaveBeenCalled();
  });

  it('rejects a show id that is not a UUID', async () => {
    const { showSession } = setup();
    for (const id of ['../../x', '', 42, null, `${UUID}x`, UUID.toUpperCase()]) {
      await expect(handlers['show:activate']({}, id)).resolves.toMatchObject({ success: false });
      await expect(handlers['show:rename']({}, id, 'Name')).resolves.toMatchObject({ success: false });
      await expect(handlers['show:delete']({}, id)).resolves.toMatchObject({ success: false });
      await expect(handlers['show:import']({}, 'Bob', id)).resolves.toMatchObject({ success: false });
    }
    expect(showSession.activate).not.toHaveBeenCalled();
    expect(showSession.renameShow).not.toHaveBeenCalled();
    expect(showSession.deleteShow).not.toHaveBeenCalled();
    expect(showSession.importShow).not.toHaveBeenCalled();
  });

  it('rejects inherited object names such as "constructor" and "__proto__" on IMPORT', async () => {
    const recoveryStore = { read: vi.fn(async () => null), retire: vi.fn(), write: vi.fn(), markHandoff: vi.fn() };
    const showStore = {
      load: vi.fn(async () => ({ doc: createDocument(null, { now: 1, newId: () => UUID }) })),
      peek: vi.fn(async () => createDocument(null, { now: 1, newId: () => UUID })),
      save: vi.fn(),
    };
    const showSession = createShowSession({
      showStore,
      recoveryStore,
      listProfiles: () => Object.values(registry).map((p) => p.name),
      getCurrentProfile: () => 'Alice',
    });
    const opened = await showSession.open();
    showSession.reportReady(opened.generation, true);
    register({ showSession, debugLog: null });

    for (const profile of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      await expect(handlers['show:import']({}, profile, UUID)).resolves.toEqual({
        success: false, error: `Profile "${profile}" is not registered`,
      });
    }
    expect(showStore.peek).not.toHaveBeenCalled();
    expect(showStore.save).not.toHaveBeenCalled();
  });
});
