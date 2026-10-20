import { describe, expect, it, vi } from 'vitest';

globalThis.window = globalThis.window || {};
window.debugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const { runBoardCommand, nextBoardAfterDelete } = await import('../../../src/renderer/modules/boards/commands.js');

const ok = (data = null) => ({ success: true, data });
const fail = (error, code) => ({ success: false, error, ...(code ? { code } : {}) });
const nameFail = (error) => fail(error, 'invalid-name');

const liveLayout = { hotkeys: [{ tabNumber: 1, tabName: 'Live', hotkeys: { f1: '1001' } }], holdingTank: [], selected: { hotkeyTab: 1, holdingTankTab: 1 } };
const loaded = (generation = 5, tabName = 'Loaded') => ok({
  layout: { hotkeys: [{ tabNumber: 1, tabName, hotkeys: {} }], holdingTank: [] },
  generation
});

const board = (id, name) => ({ id, name, createdAt: 1, updatedAt: 1, layout: {} });
const threeBoards = () => ({
  version: 1,
  activeBoardId: 'b2',
  boards: [board('b1', 'Opening'), board('b2', 'Main Show'), board('b3', 'Encore')]
});

function setup({ doc = threeBoards(), status = 'ready', modalOpen = false } = {}) {
  const calls = [];
  const api = {
    getState: vi.fn(async () => ok({ profile: 'Jesse', status, doc, generation: 4 })),
    activate: vi.fn(async () => loaded(5, 'Switched')),
    revert: vi.fn(async () => loaded(6, 'Reverted')),
    updateActive: vi.fn(async () => ok(null)),
    create: vi.fn(async (name) => ok({ id: 'b9', name })),
    rename: vi.fn(async (id, name) => ok({ id, name })),
    remove: vi.fn(async (id) => (id === doc.activeBoardId
      ? ok({ activeChanged: true, ...loaded(7, 'Next').data })
      : ok({ activeChanged: false }))),
    listImportable: vi.fn(async () => ok([{ profile: 'Derek', boards: [{ id: 'd1', name: 'Comedy Sports', updatedAt: 1 }] }])),
    importBoard: vi.fn(async () => loaded(8, 'Imported')),
    reportReady: vi.fn(async (generation, ready) => { calls.push(`ready:${generation}:${ready}`); return ok(null); })
  };
  const deps = {
    api,
    confirm: vi.fn(async () => true),
    prompt: vi.fn(async () => null),
    alert: vi.fn(),
    toast: vi.fn(),
    track: vi.fn(),
    isModalOpen: vi.fn(() => modalOpen),
    extractLayout: vi.fn(() => liveLayout),
    chooseImportBoard: vi.fn(async () => ({ profile: 'Derek', boardId: 'd1' })),
    applyLayout: vi.fn(async (layout) => { calls.push(`apply:${layout.hotkeys[0].tabName}`); return { dropped: 0 }; })
  };
  return { api, deps, calls, doc };
}

describe('runBoardCommand', () => {
  it('update asks once, naming the board, and stores the on-screen layout', async () => {
    const { api, deps } = setup();
    await runBoardCommand({ command: 'update' }, deps);
    expect(deps.confirm).toHaveBeenCalledOnce();
    expect(deps.confirm).toHaveBeenCalledWith(
      '"Main Show" will open with the layout on screen now. Its saved layout will be replaced.',
      'Update "Main Show"?',
      { confirmLabel: 'Update' }
    );
    expect(api.updateActive).toHaveBeenCalledWith(liveLayout);
    expect(deps.applyLayout).not.toHaveBeenCalled();
    expect(deps.track).toHaveBeenCalledWith('board_updated', undefined);
  });

  it('cancelling update writes nothing', async () => {
    const { api, deps } = setup();
    deps.confirm.mockResolvedValue(false);
    await runBoardCommand({ command: 'update' }, deps);
    expect(api.updateActive).not.toHaveBeenCalled();
    expect(deps.extractLayout).not.toHaveBeenCalled();
    expect(deps.track).not.toHaveBeenCalled();
  });

  it('switch activates, applies and reports ready without asking', async () => {
    const { api, deps, calls } = setup();
    await runBoardCommand({ command: 'switch', boardId: 'b3' }, deps);
    expect(deps.confirm).not.toHaveBeenCalled();
    expect(api.activate).toHaveBeenCalledWith('b3');
    expect(calls).toEqual(['apply:Switched', 'ready:5:true']);
    expect(deps.track).toHaveBeenCalledWith('board_switched', undefined);
  });

  it('a switch whose layout fails to apply reports failed and alerts', async () => {
    const { deps, calls } = setup();
    deps.applyLayout.mockRejectedValue(new Error('song fetch failed'));
    await runBoardCommand({ command: 'switch', boardId: 'b3' }, deps);
    expect(calls).toEqual(['ready:5:false']);
    expect(deps.alert).toHaveBeenCalledWith("Mx. Voice couldn't load this board. Your saved boards were not changed.", 'Board not loaded');
    expect(deps.track).not.toHaveBeenCalled();
  });

  it('toasts songs missing from the library after loading a board', async () => {
    const { deps } = setup();
    deps.applyLayout.mockResolvedValue({ dropped: 2, droppedIds: ['31', '32'] });
    await runBoardCommand({ command: 'switch', boardId: 'b3' }, deps);
    expect(deps.toast).toHaveBeenCalledWith("2 songs in this board aren't in the library.", expect.any(Number));
    expect(deps.api.reportReady).toHaveBeenCalledWith(5, true, { droppedIds: ['31', '32'] });
  });

  it('revert asks, then reloads the saved board', async () => {
    const { api, deps, calls } = setup();
    await runBoardCommand({ command: 'revert' }, deps);
    expect(deps.confirm).toHaveBeenCalledWith(
      'Changes since "Main Show" was opened will be discarded.',
      'Revert to "Main Show"?',
      { confirmLabel: 'Revert' }
    );
    expect(api.revert).toHaveBeenCalledOnce();
    expect(calls).toEqual(['apply:Reverted', 'ready:6:true']);
    expect(deps.track).toHaveBeenCalledWith('board_reverted', undefined);

    const cancelled = setup();
    cancelled.deps.confirm.mockResolvedValue(false);
    await runBoardCommand({ command: 'revert' }, cancelled.deps);
    expect(cancelled.api.revert).not.toHaveBeenCalled();
  });

  it('new creates a board from the on-screen layout', async () => {
    const { api, deps } = setup();
    deps.prompt.mockResolvedValueOnce('Late Show');
    await runBoardCommand({ command: 'new' }, deps);
    expect(deps.prompt).toHaveBeenCalledWith('Name for the new board', '', 'New Board');
    expect(api.create).toHaveBeenCalledWith('Late Show', liveLayout);
    expect(deps.track).toHaveBeenCalledWith('board_created', undefined);
  });

  it('new re-prompts on a duplicate name with the validation message', async () => {
    const { api, deps } = setup();
    api.create
      .mockResolvedValueOnce(nameFail('A board with this name already exists.'))
      .mockResolvedValueOnce(nameFail("Board names can't contain line breaks or control characters."));
    deps.prompt
      .mockResolvedValueOnce('Opening')
      .mockResolvedValueOnce('Act\nTwo')
      .mockResolvedValueOnce(null);
    await runBoardCommand({ command: 'new' }, deps);
    expect(deps.prompt.mock.calls).toEqual([
      ['Name for the new board', '', 'New Board'],
      ['A board with this name already exists.', 'Opening', 'New Board'],
      ["Board names can't contain line breaks or control characters.", 'Act\nTwo', 'New Board']
    ]);
    expect(api.create).toHaveBeenCalledTimes(2);
    expect(deps.track).not.toHaveBeenCalled();
    expect(deps.alert).not.toHaveBeenCalled();
  });

  it('an error without the invalid-name code alerts instead of re-prompting', async () => {
    const { api, deps } = setup();
    api.create.mockResolvedValueOnce(fail('A board with this name already exists.'));
    deps.prompt.mockResolvedValueOnce('Opening');
    await runBoardCommand({ command: 'new' }, deps);
    expect(deps.prompt).toHaveBeenCalledOnce();
    expect(deps.alert).toHaveBeenCalledOnce();
  });

  it('rename prompts with the current name and re-prompts on a validation error', async () => {
    const { api, deps } = setup();
    api.rename.mockResolvedValueOnce(nameFail('A board with this name already exists.'));
    deps.prompt.mockResolvedValueOnce('Encore').mockResolvedValueOnce('Finale');
    await runBoardCommand({ command: 'rename', boardId: 'b1' }, deps);
    expect(deps.prompt.mock.calls).toEqual([
      ['New name', 'Opening', 'Rename Board'],
      ['A board with this name already exists.', 'Encore', 'Rename Board']
    ]);
    expect(api.rename).toHaveBeenLastCalledWith('b1', 'Finale');
    expect(deps.track).toHaveBeenCalledWith('board_renamed', undefined);
  });

  it('deleting a non-active board does not apply a layout', async () => {
    const { api, deps, calls } = setup();
    await runBoardCommand({ command: 'delete', boardId: 'b1' }, deps);
    expect(deps.confirm).toHaveBeenCalledWith(
      "This can't be undone.",
      'Delete "Opening"?',
      { confirmLabel: 'Delete', defaultAction: 'cancel' }
    );
    expect(api.remove).toHaveBeenCalledWith('b1');
    expect(deps.applyLayout).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
    expect(deps.track).toHaveBeenCalledWith('board_deleted', { was_active: false });
  });

  it('deleting the active board names the next one and loads it', async () => {
    const { api, deps, calls } = setup();
    await runBoardCommand({ command: 'delete', boardId: 'b2' }, deps);
    expect(deps.confirm).toHaveBeenCalledWith(
      'The layout on screen will be replaced with "Encore".',
      'Delete "Main Show"?',
      { confirmLabel: 'Delete', defaultAction: 'cancel' }
    );
    expect(api.remove).toHaveBeenCalledWith('b2');
    expect(calls).toEqual(['apply:Next', 'ready:7:true']);
    expect(deps.track).toHaveBeenCalledWith('board_deleted', { was_active: true });
  });

  it('a delete whose next board fails to load is still counted', async () => {
    const { deps, calls } = setup();
    deps.applyLayout.mockRejectedValue(new Error('song fetch failed'));
    await runBoardCommand({ command: 'delete', boardId: 'b2' }, deps);
    expect(calls).toEqual(['ready:7:false']);
    expect(deps.alert).toHaveBeenCalledWith("Mx. Voice couldn't load this board. Your saved boards were not changed.", 'Board not loaded');
    expect(deps.track).toHaveBeenCalledWith('board_deleted', { was_active: true });
  });

  it('deleting the only board offers an empty board; cancelling deletes nothing', async () => {
    const doc = { version: 1, activeBoardId: 'b1', boards: [board('b1', 'Solo')] };
    const { api, deps } = setup({ doc });
    deps.confirm.mockResolvedValue(false);
    await runBoardCommand({ command: 'delete', boardId: 'b1' }, deps);
    expect(deps.confirm).toHaveBeenCalledWith(
      'The layout on screen will be replaced with an empty board.',
      'Delete "Solo"?',
      { confirmLabel: 'Delete', defaultAction: 'cancel' }
    );
    expect(api.remove).not.toHaveBeenCalled();
  });

  it('picks the next board in creation order, or the previous for the last', () => {
    const doc = threeBoards();
    expect(nextBoardAfterDelete(doc, 'b1').name).toBe('Main Show');
    expect(nextBoardAfterDelete(doc, 'b2').name).toBe('Encore');
    expect(nextBoardAfterDelete(doc, 'b3').name).toBe('Main Show');
    expect(nextBoardAfterDelete({ boards: [board('b1', 'Solo')] }, 'b1')).toBeNull();
  });

  it('import opens the dialog from listImportable and loads the copy', async () => {
    const { api, deps, calls } = setup();
    deps.applyLayout.mockImplementation(async (layout) => { calls.push(`apply:${layout.hotkeys[0].tabName}`); return { dropped: 1 }; });
    await runBoardCommand({ command: 'import' }, deps);
    expect(deps.chooseImportBoard).toHaveBeenCalledWith([
      { profile: 'Derek', boards: [{ id: 'd1', name: 'Comedy Sports', updatedAt: 1 }] }
    ]);
    expect(api.importBoard).toHaveBeenCalledWith('Derek', 'd1');
    expect(calls).toEqual(['apply:Imported', 'ready:8:true']);
    expect(deps.toast).toHaveBeenCalledWith("1 song in this board isn't in the library.", expect.any(Number));
    expect(deps.track).toHaveBeenCalledWith('board_imported', undefined);

    const cancelled = setup();
    cancelled.deps.chooseImportBoard.mockResolvedValue(null);
    await runBoardCommand({ command: 'import' }, cancelled.deps);
    expect(cancelled.api.importBoard).not.toHaveBeenCalled();
  });

  it('a command arriving while another runs is dropped', async () => {
    const { api, deps } = setup();
    let answer;
    deps.confirm.mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));
    const first = runBoardCommand({ command: 'update' }, deps);
    await vi.waitFor(() => expect(answer).toBeTypeOf('function'));

    await runBoardCommand({ command: 'switch', boardId: 'b3' }, deps);
    await runBoardCommand({ command: 'revert' }, deps);
    expect(api.activate).not.toHaveBeenCalled();
    expect(api.revert).not.toHaveBeenCalled();

    answer(true);
    await first;
    expect(api.updateActive).toHaveBeenCalledOnce();
    // Free again once the first settles
    await runBoardCommand({ command: 'switch', boardId: 'b3' }, deps);
    expect(api.activate).toHaveBeenCalledOnce();
  });

  it('update is dropped while Preferences is open; switch still runs', async () => {
    const { api, deps } = setup({ modalOpen: true });
    for (const command of ['update', 'new', 'revert', 'rename', 'delete', 'import']) {
      await runBoardCommand({ command, boardId: 'b1' }, deps);
    }
    expect(deps.confirm).not.toHaveBeenCalled();
    expect(deps.prompt).not.toHaveBeenCalled();
    expect(deps.chooseImportBoard).not.toHaveBeenCalled();
    expect(api.getState).not.toHaveBeenCalled();

    await runBoardCommand({ command: 'switch', boardId: 'b3' }, deps);
    expect(api.activate).toHaveBeenCalledWith('b3');
  });

  it('does not prompt when the session is not ready', async () => {
    const { api, deps } = setup({ status: 'loading' });
    await runBoardCommand({ command: 'update' }, deps);
    expect(deps.confirm).not.toHaveBeenCalled();
    expect(api.updateActive).not.toHaveBeenCalled();
    expect(deps.alert).not.toHaveBeenCalled();
  });

  it('a busy session is logged, not alerted; other failures alert', async () => {
    const busy = setup();
    busy.api.activate.mockResolvedValue(fail('busy'));
    await runBoardCommand({ command: 'switch', boardId: 'b3' }, busy.deps);
    expect(busy.deps.alert).not.toHaveBeenCalled();
    expect(busy.deps.applyLayout).not.toHaveBeenCalled();

    const broken = setup();
    broken.api.updateActive.mockResolvedValue(fail('disk full'));
    await runBoardCommand({ command: 'update' }, broken.deps);
    expect(broken.deps.alert).toHaveBeenCalledWith(
      "Mx. Voice couldn't change the board. Your saved boards were not changed.",
      'Board not changed'
    );
    expect(broken.deps.track).not.toHaveBeenCalled();
  });

  it('ignores unknown commands and never sends names to analytics', async () => {
    const { deps } = setup();
    await runBoardCommand({ command: 'import-hotkey-file' }, deps);
    expect(deps.api.getState).not.toHaveBeenCalled();

    deps.prompt.mockResolvedValueOnce('Secret Name');
    await runBoardCommand({ command: 'new' }, deps);
    await runBoardCommand({ command: 'delete', boardId: 'b1' }, deps);
    const sent = JSON.stringify(deps.track.mock.calls);
    for (const name of ['Secret Name', 'Opening', 'Main Show', 'Jesse', 'Derek']) expect(sent).not.toContain(name);
  });
});
