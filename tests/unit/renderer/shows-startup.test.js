import { beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.window = { debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } };

const { openSessionOnStartup, droppedSongsMessage, initializeShowCommands } = await import('../../../src/renderer/modules/shows/index.js');

const savedLayout = { hotkeys: [{ tabNumber: 1, tabName: 'Saved', hotkeys: { f1: '1001' } }], holdingTank: [], selected: { hotkeyTab: 1, holdingTankTab: 1 } };
const liveLayout = { hotkeys: [{ tabNumber: 1, tabName: 'Live', hotkeys: { f1: '1002' } }], holdingTank: [], selected: { hotkeyTab: 2, holdingTankTab: 1 } };
const ok = (data) => ({ success: true, data });

function setup({ open, confirm = vi.fn(async () => false), dropped = 0 } = {}) {
  const calls = [];
  const api = {
    open: vi.fn(async () => open),
    startEmpty: vi.fn(async () => ok({ layout: savedLayout, generation: 8 })),
    resolveRecovery: vi.fn(async (choice) => ok({ layout: choice === 'restore' ? liveLayout : savedLayout })),
    reportReady: vi.fn(async (generation, ready) => { calls.push(`ready:${generation}:${ready}`); return ok(null); })
  };
  const deps = {
    api,
    confirm,
    applyLayout: vi.fn(async (layout) => { calls.push(`apply:${layout.hotkeys[0]?.tabName}`); return { dropped, droppedIds: dropped ? ['77'] : [] }; }),
    alert: vi.fn(),
    toast: vi.fn(),
    quit: vi.fn(async () => ok(null)),
    clearRestorationLock: vi.fn(() => { calls.push('unlock'); }),
    track: vi.fn(),
    refreshHeader: vi.fn(async () => {})
  };
  return { api, deps, calls };
}

const opened = (recovery = null, extra = {}) => ok({ doc: {}, show: { layout: savedLayout }, recovery, generation: 7, ...extra });

describe('openSessionOnStartup', () => {
  beforeEach(() => { window.isRestoringProfileState = false; });

  it('restores silently when recovery.handoff is "update"', async () => {
    const { api, deps, calls } = setup({ open: opened({ savedAt: Date.now(), handoff: 'update', showId: 'b1' }) });
    await expect(openSessionOnStartup(deps)).resolves.toEqual({ status: 'ready' });
    expect(deps.confirm).not.toHaveBeenCalled();
    expect(api.resolveRecovery).toHaveBeenCalledWith('restore');
    expect(calls).toEqual(['apply:Live', 'ready:7:true', 'unlock']);
  });

  it('asks once when recovery exists without handoff; default discards', async () => {
    const savedAt = new Date(2026, 9, 20, 21, 5).getTime();
    const { api, deps, calls } = setup({ open: opened({ savedAt, handoff: null, showId: 'b1' }) });
    deps.confirm.mockImplementation(async () => {
      // The restoration lock is held while the question is open
      expect(window.isRestoringProfileState).toBe(true);
      return false;
    });
    await openSessionOnStartup(deps);
    const time = new Date(savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    expect(deps.confirm).toHaveBeenCalledOnce();
    expect(deps.confirm).toHaveBeenCalledWith(
      `Mx. Voice didn't close normally. Restore the show in progress from ${time}?`,
      'Restore show?',
      { confirmLabel: 'Restore show in progress', cancelLabel: 'Open saved show', defaultAction: 'cancel' }
    );
    expect(api.resolveRecovery).toHaveBeenCalledWith('discard');
    expect(calls).toEqual(['apply:Saved', 'ready:7:true', 'unlock']);
  });

  it('restores the show in progress when the prompt is confirmed', async () => {
    const { api, deps, calls } = setup({
      open: opened({ savedAt: Date.now(), handoff: null, showId: 'b1' }),
      confirm: vi.fn(async () => true)
    });
    await openSessionOnStartup(deps);
    expect(api.resolveRecovery).toHaveBeenCalledWith('restore');
    expect(calls[0]).toBe('apply:Live');
  });

  it('opens the saved show without asking when there is no recovery', async () => {
    const { api, deps, calls } = setup({ open: opened() });
    await openSessionOnStartup(deps);
    expect(deps.confirm).not.toHaveBeenCalled();
    expect(api.resolveRecovery).toHaveBeenCalledWith('discard');
    expect(calls).toEqual(['apply:Saved', 'ready:7:true', 'unlock']);
  });

  it('reports failed and never applies an empty layout when open throws', async () => {
    const message = "Mx. Voice couldn't load this show. Your saved shows were not changed.";

    const failedStore = setup({ open: ok({ failed: true, error: 'version', generation: 3 }) });
    await expect(openSessionOnStartup(failedStore.deps)).resolves.toEqual({ status: 'failed' });
    expect(failedStore.deps.applyLayout).not.toHaveBeenCalled();
    expect(failedStore.calls).toEqual(['ready:3:false', 'unlock']);
    expect(failedStore.deps.alert).toHaveBeenCalledWith(message, expect.any(String));

    const rejected = setup({ open: { success: false, error: 'Show session unavailable' } });
    await expect(openSessionOnStartup(rejected.deps)).resolves.toEqual({ status: 'failed' });
    expect(rejected.deps.applyLayout).not.toHaveBeenCalled();
    expect(rejected.api.reportReady).not.toHaveBeenCalled();
    expect(rejected.deps.clearRestorationLock).toHaveBeenCalledOnce();

    const applyThrows = setup({ open: opened() });
    applyThrows.deps.applyLayout.mockRejectedValue(new Error('song fetch failed'));
    await expect(openSessionOnStartup(applyThrows.deps)).resolves.toEqual({ status: 'failed' });
    expect(applyThrows.calls).toEqual(['ready:7:false', 'unlock']);
    expect(applyThrows.deps.alert).toHaveBeenCalledWith(message, expect.any(String));
  });

  it('after starting empty, a crash record still prompts, and a handoff still restores silently', async () => {
    const savedAt = Date.now();
    const prompted = setup({ open: ok({ unreadable: true, generation: 4 }), confirm: vi.fn(async () => true) });
    prompted.api.startEmpty.mockResolvedValue(ok({ layout: savedLayout, generation: 8, recovery: { savedAt, handoff: null, showId: 'b1' } }));
    await expect(openSessionOnStartup(prompted.deps)).resolves.toEqual({ status: 'ready' });
    expect(prompted.deps.confirm).toHaveBeenCalledTimes(2);
    expect(prompted.deps.confirm.mock.calls[1][1]).toBe('Restore show?');
    expect(prompted.api.resolveRecovery).toHaveBeenCalledWith('restore');
    expect(prompted.calls).toEqual(['apply:Live', 'ready:8:true', 'unlock']);
    expect(prompted.deps.track).toHaveBeenCalledWith('crash_restore_offered');

    const handedOff = setup({ open: ok({ unreadable: true, generation: 4 }), confirm: vi.fn(async () => true) });
    handedOff.api.startEmpty.mockResolvedValue(ok({ layout: savedLayout, generation: 8, recovery: { savedAt, handoff: 'renderer-crash', showId: 'b1' } }));
    await openSessionOnStartup(handedOff.deps);
    expect(handedOff.deps.confirm).toHaveBeenCalledOnce();
    expect(handedOff.api.resolveRecovery).toHaveBeenCalledWith('restore');
    expect(handedOff.calls).toEqual(['apply:Live', 'ready:8:true', 'unlock']);
  });

  it('an unreadable store offers Start with an empty show or Quit', async () => {
    const expectedPrompt = [
      "Mx. Voice couldn't read this profile's shows. The file has been kept so it can be recovered.",
      'Shows unreadable',
      { confirmLabel: 'Start with an empty show', cancelLabel: 'Quit' }
    ];

    const start = setup({ open: ok({ unreadable: true, generation: 4 }), confirm: vi.fn(async () => true) });
    await expect(openSessionOnStartup(start.deps)).resolves.toEqual({ status: 'ready' });
    expect(start.deps.confirm).toHaveBeenCalledWith(...expectedPrompt);
    expect(start.api.startEmpty).toHaveBeenCalledOnce();
    expect(start.api.resolveRecovery).not.toHaveBeenCalled();
    // startEmpty's generation is the one reported
    expect(start.calls).toEqual(['apply:Saved', 'ready:8:true', 'unlock']);

    const quit = setup({ open: ok({ unreadable: true, generation: 4 }), confirm: vi.fn(async () => false) });
    await openSessionOnStartup(quit.deps);
    expect(quit.deps.quit).toHaveBeenCalledOnce();
    expect(quit.api.startEmpty).not.toHaveBeenCalled();
    expect(quit.deps.applyLayout).not.toHaveBeenCalled();
  });

  it('shows the store notice and missing songs as one non-blocking toast', async () => {
    const { deps } = setup({ open: opened(null, { notice: 'Opened the previous copy.' }), dropped: 3 });
    await openSessionOnStartup(deps);
    expect(deps.toast).toHaveBeenCalledWith("Opened the previous copy. 3 songs in this show aren't in the library.", expect.any(Number));
    // The session is told which songs were dropped
    expect(deps.api.reportReady).toHaveBeenCalledWith(7, true, { droppedIds: ['77'] });
  });

  it('words the missing-songs toast in the singular and plural', () => {
    expect(droppedSongsMessage(0)).toBeNull();
    expect(droppedSongsMessage(1)).toBe("1 song in this show isn't in the library.");
    expect(droppedSongsMessage(3)).toBe("3 songs in this show aren't in the library.");
  });

  it('reports the crash prompt and the choice to analytics', async () => {
    const asked = setup({ open: opened({ savedAt: Date.now(), handoff: null, showId: 'b1' }), confirm: vi.fn(async () => true) });
    await openSessionOnStartup(asked.deps);
    expect(asked.deps.track.mock.calls).toEqual([
      ['crash_restore_offered'],
      ['crash_restore_chosen', { choice: 'restore' }]
    ]);

    const declined = setup({ open: opened({ savedAt: Date.now(), handoff: null, showId: 'b1' }) });
    await openSessionOnStartup(declined.deps);
    expect(declined.deps.track).toHaveBeenLastCalledWith('crash_restore_chosen', { choice: 'discard' });

    // A silent handoff restore and a clean open ask nothing
    const handoff = setup({ open: opened({ savedAt: Date.now(), handoff: 'update', showId: 'b1' }) });
    await openSessionOnStartup(handoff.deps);
    const clean = setup({ open: opened() });
    await openSessionOnStartup(clean.deps);
    expect(handoff.deps.track).not.toHaveBeenCalled();
    expect(clean.deps.track).not.toHaveBeenCalled();
  });
});

describe('header refresh', () => {
  beforeEach(() => { window.isRestoringProfileState = false; });

  it('refreshes the header after startup finishes, ready or failed', async () => {
    const ready = setup({ open: opened() });
    await openSessionOnStartup(ready.deps);
    expect(ready.deps.refreshHeader).toHaveBeenCalledOnce();
    expect(ready.deps.refreshHeader.mock.invocationCallOrder[0]).toBeGreaterThan(ready.deps.clearRestorationLock.mock.invocationCallOrder[0]);

    const failed = setup({ open: ok({ failed: true, error: 'boom', generation: 4 }) });
    await openSessionOnStartup(failed.deps);
    expect(failed.deps.refreshHeader).toHaveBeenCalledOnce();
  });

  it('refreshes the header after a show command, even a refused one', async () => {
    let listener;
    const onShowCommand = vi.fn((cb) => { listener = cb; return vi.fn(); });
    const refreshHeader = vi.fn(async () => {});
    const api = { activate: vi.fn(async () => ({ success: false, error: 'busy' })), reportReady: vi.fn() };
    initializeShowCommands({ onShowCommand, api, applyLayout: vi.fn(), track: vi.fn(), isModalOpen: () => false, refreshHeader });
    listener({ command: 'switch', showId: 'b2' });
    await vi.waitFor(() => expect(refreshHeader).toHaveBeenCalledOnce());
    expect(api.activate).toHaveBeenCalledWith('b2');
  });
});

describe('initializeShowCommands', () => {
  it('runs each menu:show-command with the injected deps', async () => {
    let listener;
    const unsubscribe = vi.fn();
    const onShowCommand = vi.fn((cb) => { listener = cb; return unsubscribe; });
    const api = {
      activate: vi.fn(async () => ok({ layout: savedLayout, generation: 3 })),
      reportReady: vi.fn(async () => ok(null))
    };
    const applyLayout = vi.fn(async () => ({ dropped: 0 }));
    const track = vi.fn();

    expect(initializeShowCommands({ onShowCommand, api, applyLayout, track, isModalOpen: () => true })).toBe(unsubscribe);
    listener({ command: 'switch', showId: 'b2' });
    await vi.waitFor(() => expect(api.reportReady).toHaveBeenCalledWith(3, true, { droppedIds: [] }));
    expect(api.activate).toHaveBeenCalledWith('b2');
    expect(applyLayout).toHaveBeenCalledWith(savedLayout);
    expect(track).toHaveBeenCalledWith('show_switched', undefined);
  });

  it('does nothing without the preload event', () => {
    expect(initializeShowCommands({ onShowCommand: null, applyLayout: vi.fn() })).toBeNull();
  });
});
