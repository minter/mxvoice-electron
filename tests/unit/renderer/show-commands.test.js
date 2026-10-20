import { describe, expect, it, vi } from 'vitest';

globalThis.window = globalThis.window || {};
window.debugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const { runShowCommand, nextShowAfterDelete } = await import('../../../src/renderer/modules/shows/commands.js');

const ok = (data = null) => ({ success: true, data });
const fail = (error, code) => ({ success: false, error, ...(code ? { code } : {}) });
const nameFail = (error) => fail(error, 'invalid-name');

const liveLayout = { hotkeys: [{ tabNumber: 1, tabName: 'Live', hotkeys: { f1: '1001' } }], holdingTank: [], selected: { hotkeyTab: 1, holdingTankTab: 1 } };
const loaded = (generation = 5, tabName = 'Loaded') => ok({
  layout: { hotkeys: [{ tabNumber: 1, tabName, hotkeys: {} }], holdingTank: [] },
  generation
});

const show = (id, name) => ({ id, name, createdAt: 1, updatedAt: 1, layout: {} });
const threeShows = () => ({
  version: 1,
  activeShowId: 'b2',
  shows: [show('b1', 'Opening'), show('b2', 'Main Show'), show('b3', 'Encore')]
});

function setup({ doc = threeShows(), status = 'ready', modalOpen = false, dirty = false } = {}) {
  const calls = [];
  const api = {
    getState: vi.fn(async () => ok({ profile: 'Jesse', status, doc, generation: 4, dirty })),
    activate: vi.fn(async () => loaded(5, 'Switched')),
    revert: vi.fn(async () => loaded(6, 'Reverted')),
    updateActive: vi.fn(async () => ok(null)),
    create: vi.fn(async (name) => ok({ id: 'b9', name })),
    rename: vi.fn(async (id, name) => ok({ id, name })),
    remove: vi.fn(async (id) => (id === doc.activeShowId
      ? ok({ activeChanged: true, ...loaded(7, 'Next').data })
      : ok({ activeChanged: false }))),
    listImportable: vi.fn(async () => ok([{ profile: 'Derek', shows: [{ id: 'd1', name: 'Comedy Sports', updatedAt: 1 }] }])),
    importShow: vi.fn(async () => loaded(8, 'Imported')),
    reportReady: vi.fn(async (generation, ready) => { calls.push(`ready:${generation}:${ready}`); return ok(null); })
  };
  const deps = {
    api,
    confirm: vi.fn(async () => true),
    choose: vi.fn(async () => 'cancel'),
    flushRecovery: vi.fn(async () => ({ success: true })),
    prompt: vi.fn(async () => null),
    alert: vi.fn(),
    toast: vi.fn(),
    track: vi.fn(),
    isModalOpen: vi.fn(() => modalOpen),
    extractLayout: vi.fn(() => liveLayout),
    chooseImportShow: vi.fn(async () => ({ profile: 'Derek', showId: 'd1' })),
    applyLayout: vi.fn(async (layout) => { calls.push(`apply:${layout.hotkeys[0].tabName}`); return { dropped: 0 }; })
  };
  return { api, deps, calls, doc };
}

describe('runShowCommand', () => {
  it('save asks once, naming the show, and stores the on-screen layout', async () => {
    const { api, deps } = setup();
    await runShowCommand({ command: 'save' }, deps);
    expect(deps.confirm).toHaveBeenCalledOnce();
    expect(deps.confirm).toHaveBeenCalledWith(
      '"Main Show" will open with the layout on screen now. Its saved layout will be replaced.',
      'Save "Main Show"?',
      { confirmLabel: 'Save' }
    );
    expect(api.updateActive).toHaveBeenCalledWith(liveLayout);
    expect(deps.applyLayout).not.toHaveBeenCalled();
    expect(deps.track).toHaveBeenCalledWith('show_saved', undefined);
  });

  it('cancelling save writes nothing', async () => {
    const { api, deps } = setup();
    deps.confirm.mockResolvedValue(false);
    await runShowCommand({ command: 'save' }, deps);
    expect(api.updateActive).not.toHaveBeenCalled();
    expect(deps.extractLayout).not.toHaveBeenCalled();
    expect(deps.track).not.toHaveBeenCalled();
  });

  it('switch activates, applies and reports ready without asking', async () => {
    const { api, deps, calls } = setup();
    await runShowCommand({ command: 'switch', showId: 'b3' }, deps);
    expect(deps.confirm).not.toHaveBeenCalled();
    expect(api.activate).toHaveBeenCalledWith('b3');
    expect(calls).toEqual(['apply:Switched', 'ready:5:true']);
    expect(deps.track).toHaveBeenCalledWith('show_switched', undefined);
  });

  it('a switch whose layout fails to apply reports failed and alerts', async () => {
    const { deps, calls } = setup();
    deps.applyLayout.mockRejectedValue(new Error('song fetch failed'));
    await runShowCommand({ command: 'switch', showId: 'b3' }, deps);
    expect(calls).toEqual(['ready:5:false']);
    expect(deps.alert).toHaveBeenCalledWith("Mx. Voice couldn't load this show. Your saved shows were not changed.", 'Show not loaded');
    expect(deps.track).not.toHaveBeenCalled();
  });

  it('toasts songs missing from the library after loading a show', async () => {
    const { deps } = setup();
    deps.applyLayout.mockResolvedValue({ dropped: 2, droppedIds: ['31', '32'] });
    await runShowCommand({ command: 'switch', showId: 'b3' }, deps);
    expect(deps.toast).toHaveBeenCalledWith("2 songs in this show aren't in the library.", expect.any(Number));
    expect(deps.api.reportReady).toHaveBeenCalledWith(5, true, { droppedIds: ['31', '32'] });
  });

  it('revert asks, then reloads the saved show', async () => {
    const { api, deps, calls } = setup();
    await runShowCommand({ command: 'revert' }, deps);
    expect(deps.confirm).toHaveBeenCalledWith(
      'Changes since "Main Show" was opened will be discarded.',
      'Revert to "Main Show"?',
      { confirmLabel: 'Revert' }
    );
    expect(api.revert).toHaveBeenCalledOnce();
    expect(calls).toEqual(['apply:Reverted', 'ready:6:true']);
    expect(deps.track).toHaveBeenCalledWith('show_reverted', undefined);

    const cancelled = setup();
    cancelled.deps.confirm.mockResolvedValue(false);
    await runShowCommand({ command: 'revert' }, cancelled.deps);
    expect(cancelled.api.revert).not.toHaveBeenCalled();
  });

  it('save-as creates a show from the on-screen layout', async () => {
    const { api, deps } = setup();
    deps.prompt.mockResolvedValueOnce('Late Show');
    await runShowCommand({ command: 'save-as' }, deps);
    expect(deps.prompt).toHaveBeenCalledWith('Name for the new show', '', 'Save As');
    expect(api.create).toHaveBeenCalledWith('Late Show', liveLayout);
    expect(deps.track).toHaveBeenCalledWith('show_saved_as', undefined);
  });

  it('save-as re-prompts on a duplicate name with the validation message', async () => {
    const { api, deps } = setup();
    api.create
      .mockResolvedValueOnce(nameFail('A show with this name already exists.'))
      .mockResolvedValueOnce(nameFail("Show names can't contain line breaks or control characters."));
    deps.prompt
      .mockResolvedValueOnce('Opening')
      .mockResolvedValueOnce('Act\nTwo')
      .mockResolvedValueOnce(null);
    await runShowCommand({ command: 'save-as' }, deps);
    expect(deps.prompt.mock.calls).toEqual([
      ['Name for the new show', '', 'Save As'],
      ['A show with this name already exists.', 'Opening', 'Save As'],
      ["Show names can't contain line breaks or control characters.", 'Act\nTwo', 'Save As']
    ]);
    expect(api.create).toHaveBeenCalledTimes(2);
    expect(deps.track).not.toHaveBeenCalled();
    expect(deps.alert).not.toHaveBeenCalled();
  });

  it('an error without the invalid-name code alerts instead of re-prompting', async () => {
    const { api, deps } = setup();
    api.create.mockResolvedValueOnce(fail('A show with this name already exists.'));
    deps.prompt.mockResolvedValueOnce('Opening');
    await runShowCommand({ command: 'save-as' }, deps);
    expect(deps.prompt).toHaveBeenCalledOnce();
    expect(deps.alert).toHaveBeenCalledOnce();
  });

  it('rename targets the active show, prompting with its name and re-prompting on a validation error', async () => {
    const { api, deps } = setup();
    api.rename.mockResolvedValueOnce(nameFail('A show with this name already exists.'));
    deps.prompt.mockResolvedValueOnce('Encore').mockResolvedValueOnce('Finale');
    await runShowCommand({ command: 'rename' }, deps);
    expect(deps.prompt.mock.calls).toEqual([
      ['New name', 'Main Show', 'Rename Show'],
      ['A show with this name already exists.', 'Encore', 'Rename Show']
    ]);
    expect(api.rename).toHaveBeenLastCalledWith('b2', 'Finale');
    expect(deps.track).toHaveBeenCalledWith('show_renamed', undefined);
  });

  it('rename and delete ignore a show id and act on the active show', async () => {
    const { api, deps } = setup();
    deps.prompt.mockResolvedValueOnce('Finale');
    await runShowCommand({ command: 'rename', showId: 'b1' }, deps);
    await runShowCommand({ command: 'delete', showId: 'b1' }, deps);
    expect(api.rename).toHaveBeenCalledWith('b2', 'Finale');
    expect(api.remove).toHaveBeenCalledWith('b2');
  });

  it('deleting the active show names the next one and loads it', async () => {
    const { api, deps, calls } = setup();
    await runShowCommand({ command: 'delete' }, deps);
    expect(deps.confirm).toHaveBeenCalledWith(
      'The layout on screen will be replaced with "Encore".',
      'Delete "Main Show"?',
      { confirmLabel: 'Delete', defaultAction: 'cancel' }
    );
    expect(api.remove).toHaveBeenCalledWith('b2');
    expect(calls).toEqual(['apply:Next', 'ready:7:true']);
    expect(deps.track).toHaveBeenCalledWith('show_deleted', undefined);
  });

  it('a delete whose next show fails to load is still counted', async () => {
    const { deps, calls } = setup();
    deps.applyLayout.mockRejectedValue(new Error('song fetch failed'));
    await runShowCommand({ command: 'delete' }, deps);
    expect(calls).toEqual(['ready:7:false']);
    expect(deps.alert).toHaveBeenCalledWith("Mx. Voice couldn't load this show. Your saved shows were not changed.", 'Show not loaded');
    expect(deps.track).toHaveBeenCalledWith('show_deleted', undefined);
  });

  it('deleting the only show offers an empty show; cancelling deletes nothing', async () => {
    const doc = { version: 1, activeShowId: 'b1', shows: [show('b1', 'Solo')] };
    const { api, deps } = setup({ doc });
    deps.confirm.mockResolvedValue(false);
    await runShowCommand({ command: 'delete' }, deps);
    expect(deps.confirm).toHaveBeenCalledWith(
      'The layout on screen will be replaced with an empty show.',
      'Delete "Solo"?',
      { confirmLabel: 'Delete', defaultAction: 'cancel' }
    );
    expect(api.remove).not.toHaveBeenCalled();
  });

  it('picks the next show in creation order, or the previous for the last', () => {
    const doc = threeShows();
    expect(nextShowAfterDelete(doc, 'b1').name).toBe('Main Show');
    expect(nextShowAfterDelete(doc, 'b2').name).toBe('Encore');
    expect(nextShowAfterDelete(doc, 'b3').name).toBe('Main Show');
    expect(nextShowAfterDelete({ shows: [show('b1', 'Solo')] }, 'b1')).toBeNull();
  });

  it('import opens the dialog from listImportable and loads the copy', async () => {
    const { api, deps, calls } = setup();
    deps.applyLayout.mockImplementation(async (layout) => { calls.push(`apply:${layout.hotkeys[0].tabName}`); return { dropped: 1 }; });
    await runShowCommand({ command: 'import' }, deps);
    expect(deps.chooseImportShow).toHaveBeenCalledWith([
      { profile: 'Derek', shows: [{ id: 'd1', name: 'Comedy Sports', updatedAt: 1 }] }
    ]);
    expect(api.importShow).toHaveBeenCalledWith('Derek', 'd1');
    expect(calls).toEqual(['apply:Imported', 'ready:8:true']);
    expect(deps.toast).toHaveBeenCalledWith("1 song in this show isn't in the library.", expect.any(Number));
    expect(deps.track).toHaveBeenCalledWith('show_imported', undefined);

    const cancelled = setup();
    cancelled.deps.chooseImportShow.mockResolvedValue(null);
    await runShowCommand({ command: 'import' }, cancelled.deps);
    expect(cancelled.api.importShow).not.toHaveBeenCalled();
  });

  it('a command arriving while another runs is dropped', async () => {
    const { api, deps } = setup();
    let answer;
    deps.confirm.mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));
    const first = runShowCommand({ command: 'save' }, deps);
    await vi.waitFor(() => expect(answer).toBeTypeOf('function'));

    await runShowCommand({ command: 'switch', showId: 'b3' }, deps);
    await runShowCommand({ command: 'revert' }, deps);
    expect(api.activate).not.toHaveBeenCalled();
    expect(api.revert).not.toHaveBeenCalled();

    answer(true);
    await first;
    expect(api.updateActive).toHaveBeenCalledOnce();
    // Free again once the first settles
    await runShowCommand({ command: 'switch', showId: 'b3' }, deps);
    expect(api.activate).toHaveBeenCalledOnce();
  });

  it('save is dropped while Preferences is open; switch still runs', async () => {
    const { api, deps } = setup({ modalOpen: true });
    for (const command of ['save', 'save-as', 'revert', 'rename', 'delete', 'import']) {
      await runShowCommand({ command, showId: 'b1' }, deps);
    }
    expect(deps.confirm).not.toHaveBeenCalled();
    expect(deps.prompt).not.toHaveBeenCalled();
    expect(deps.chooseImportShow).not.toHaveBeenCalled();
    expect(api.getState).not.toHaveBeenCalled();

    await runShowCommand({ command: 'switch', showId: 'b3' }, deps);
    expect(api.activate).toHaveBeenCalledWith('b3');
  });

  it('a dirty switch is dropped while another dialog is open; a clean one still runs', async () => {
    const dirtyOpen = setup({ modalOpen: true, dirty: true });
    await runShowCommand({ command: 'switch', showId: 'b3' }, dirtyOpen.deps);
    expect(dirtyOpen.deps.choose).not.toHaveBeenCalled();
    expect(dirtyOpen.api.activate).not.toHaveBeenCalled();
    expect(dirtyOpen.deps.track).not.toHaveBeenCalled();
  });

  it('does not prompt when the session is not ready', async () => {
    const { api, deps } = setup({ status: 'loading' });
    await runShowCommand({ command: 'save' }, deps);
    expect(deps.confirm).not.toHaveBeenCalled();
    expect(api.updateActive).not.toHaveBeenCalled();
    expect(deps.alert).not.toHaveBeenCalled();
  });

  it('a busy session is logged, not alerted; other failures alert', async () => {
    const busy = setup();
    busy.api.activate.mockResolvedValue(fail('busy'));
    await runShowCommand({ command: 'switch', showId: 'b3' }, busy.deps);
    expect(busy.deps.alert).not.toHaveBeenCalled();
    expect(busy.deps.applyLayout).not.toHaveBeenCalled();

    const broken = setup();
    broken.api.updateActive.mockResolvedValue(fail('disk full'));
    await runShowCommand({ command: 'save' }, broken.deps);
    expect(broken.deps.alert).toHaveBeenCalledWith(
      "Mx. Voice couldn't change the show. Your saved shows were not changed.",
      'Show not changed'
    );
    expect(broken.deps.track).not.toHaveBeenCalled();
  });

  it('ignores unknown commands and never sends names to analytics', async () => {
    const { deps } = setup();
    for (const command of ['import-hotkey-file', 'update', 'new']) await runShowCommand({ command }, deps);
    expect(deps.api.getState).not.toHaveBeenCalled();

    deps.prompt.mockResolvedValueOnce('Secret Name');
    await runShowCommand({ command: 'save-as' }, deps);
    await runShowCommand({ command: 'delete' }, deps);
    const sent = JSON.stringify(deps.track.mock.calls);
    for (const name of ['Secret Name', 'Opening', 'Main Show', 'Jesse', 'Derek']) expect(sent).not.toContain(name);
  });

  describe('asking to save unsaved changes', () => {
    const CHOICES = [
      { value: 'discard', label: "Don't Save", variant: 'secondary' },
      { value: 'cancel', label: 'Cancel', variant: 'outline' },
      { value: 'save', label: 'Save', variant: 'primary' }
    ];

    it('a clean switch or import asks nothing', async () => {
      const { api, deps } = setup();
      await runShowCommand({ command: 'switch', showId: 'b3' }, deps);
      await runShowCommand({ command: 'import' }, deps);
      expect(deps.choose).not.toHaveBeenCalled();
      expect(api.activate).toHaveBeenCalledOnce();
      expect(api.importShow).toHaveBeenCalledOnce();
    });

    for (const [command, trigger] of [['switch', 'switch'], ['import', 'import']]) {
      const proceeded = (api) => (command === 'switch' ? api.activate : api.importShow);

      it(`${command}: asks naming the show, with Cancel as the default`, async () => {
        const { api, deps } = setup({ dirty: true });
        await runShowCommand({ command, showId: 'b3' }, deps);
        expect(deps.choose).toHaveBeenCalledWith('Save changes to "Main Show"?', 'Unsaved changes', CHOICES, { defaultValue: 'cancel' });
        expect(proceeded(api)).not.toHaveBeenCalled();
      });

      it(`${command}: Cancel stops, saves nothing, and tracks only the choice`, async () => {
        const { api, deps } = setup({ dirty: true });
        deps.choose.mockResolvedValue('cancel');
        await runShowCommand({ command, showId: 'b3' }, deps);
        expect(api.updateActive).not.toHaveBeenCalled();
        expect(proceeded(api)).not.toHaveBeenCalled();
        expect(deps.chooseImportShow).not.toHaveBeenCalled();
        expect(deps.track).toHaveBeenCalledOnce();
        expect(deps.track).toHaveBeenCalledWith('show_save_prompt', { choice: 'cancel', trigger });
      });

      it(`${command}: Don't Save goes on without saving`, async () => {
        const { api, deps } = setup({ dirty: true });
        deps.choose.mockResolvedValue('discard');
        await runShowCommand({ command, showId: 'b3' }, deps);
        expect(api.updateActive).not.toHaveBeenCalled();
        expect(proceeded(api)).toHaveBeenCalledOnce();
        expect(deps.track).toHaveBeenCalledWith('show_save_prompt', { choice: 'discard', trigger });
      });

      it(`${command}: Save writes the show without its own confirm, then goes on`, async () => {
        const { api, deps, calls } = setup({ dirty: true });
        deps.choose.mockResolvedValue('save');
        api.updateActive.mockImplementation(async () => { calls.push('save'); return ok(null); });
        await runShowCommand({ command, showId: 'b3' }, deps);
        expect(deps.confirm).not.toHaveBeenCalled();
        expect(api.updateActive).toHaveBeenCalledWith(liveLayout);
        expect(proceeded(api)).toHaveBeenCalledOnce();
        expect(calls[0]).toBe('save');
        expect(deps.track).toHaveBeenCalledWith('show_save_prompt', { choice: 'save', trigger });
      });

      it(`${command}: a failed Save alerts and does not go on`, async () => {
        const { api, deps } = setup({ dirty: true });
        deps.choose.mockResolvedValue('save');
        api.updateActive.mockResolvedValue(fail('disk full'));
        await runShowCommand({ command, showId: 'b3' }, deps);
        expect(deps.alert).toHaveBeenCalledOnce();
        expect(proceeded(api)).not.toHaveBeenCalled();
        expect(deps.chooseImportShow).not.toHaveBeenCalled();
      });
    }

    it('an unexpected answer counts as Cancel', async () => {
      const { api, deps } = setup({ dirty: true });
      deps.choose.mockResolvedValue(undefined);
      await runShowCommand({ command: 'switch', showId: 'b3' }, deps);
      expect(api.activate).not.toHaveBeenCalled();
      expect(deps.track).toHaveBeenCalledWith('show_save_prompt', { choice: 'cancel', trigger: 'switch' });
    });

    it('the import dialog opens only after the prompt is answered', async () => {
      const { deps } = setup({ dirty: true });
      deps.choose.mockResolvedValue('discard');
      await runShowCommand({ command: 'import' }, deps);
      expect(deps.choose.mock.invocationCallOrder[0]).toBeLessThan(deps.chooseImportShow.mock.invocationCallOrder[0]);
    });

    it('flushes the recovery save before reading the dirty flag', async () => {
      const { api, deps } = setup({ dirty: true });
      await runShowCommand({ command: 'switch', showId: 'b3' }, deps);
      expect(deps.flushRecovery.mock.invocationCallOrder[0]).toBeLessThan(api.getState.mock.invocationCallOrder[0]);
    });

    it('a flush that throws still reads the state', async () => {
      const { deps } = setup({ dirty: true });
      deps.flushRecovery.mockRejectedValue(new Error('boom'));
      await runShowCommand({ command: 'switch', showId: 'b3' }, deps);
      expect(deps.choose).toHaveBeenCalledOnce();
    });

    it('revert, delete and save-as get no new prompt', async () => {
      const { deps } = setup({ dirty: true });
      for (const command of ['revert', 'delete', 'save-as']) await runShowCommand({ command }, deps);
      expect(deps.choose).not.toHaveBeenCalled();
    });
  });
});
