import { beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.window = { debugLog: {} };
globalThis.document = { querySelectorAll: () => [], querySelector: () => null, getElementById: () => null };

const { HotkeysModule } = await import('../../../src/renderer/modules/hotkeys/index.js');
const { default: HotkeyState } = await import('../../../src/renderer/modules/hotkeys/hotkey-state.js');
const { setupMainProcessEventBridge } = await import('../../../src/renderer/modules/event-coordination/main-process-events.js');

function slot(key) {
  const span = { textContent: '' };
  const attrs = new Map();
  return {
    id: `${key}_hotkey`,
    span,
    closest: () => ({ id: 'hotkeys_list_1' }),
    querySelector: () => span,
    setAttribute: (name, value) => attrs.set(name, value),
    removeAttribute: (name) => attrs.delete(name),
    getAttribute: (name) => attrs.get(name),
    attrs
  };
}

function hotkeysHarness(rows) {
  const slots = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${i + 1}`, slot(`f${i + 1}`)]));
  const hotkeys = Object.create(HotkeysModule.prototype);
  hotkeys.state = new HotkeyState();
  hotkeys.requestProfileStateSave = vi.fn();
  hotkeys.electronAPI = { database: { getSongsByIds: vi.fn(async () => ({ success: true, data: rows })) } };
  globalThis.document.querySelector = (selector) => {
    if (selector === '.hotkeys.active') return { id: 'hotkeys_list_1' };
    const key = selector.match(/\[id\^="(f\d+)_hotkey"\]/)?.[1];
    return key ? slots[key] : null;
  };
  return { hotkeys, slots };
}

describe('hotkey file import onto the current tab', () => {
  it('skips ids missing from the library and reports them', async () => {
    const { hotkeys, slots } = hotkeysHarness([{ id: 11, title: 'A', artist: 'B', time: '1:00' }]);

    const outcome = await hotkeys._populateHotkeysImpl({ f1: '11', f2: '999', f3: '' }, 'Show');

    expect(outcome).toEqual({ dropped: 1 });
    expect(hotkeys.electronAPI.database.getSongsByIds).toHaveBeenCalledTimes(1);
    expect(slots.f1.attrs.get('songid')).toBe('11');
    expect(slots.f1.span.textContent).toBe('A by B (1:00)');
    expect(slots.f2.attrs.has('songid')).toBe(false);
    const tab = hotkeys.state.toSnapshot()[0];
    expect(tab.hotkeys.f1).toBe('11');
    expect(Object.values(tab.hotkeys)).not.toContain('999');
    expect(tab.tabName).toBe('Show');
    expect(hotkeys.requestProfileStateSave).toHaveBeenCalledTimes(1);
  });

  it('clears the tab when a file has lines but no valid ids', async () => {
    const { hotkeys } = hotkeysHarness([]);
    hotkeys.state.assign(1, 'f5', '7');

    const outcome = await hotkeys._populateHotkeysImpl({ f1: '999' }, '');

    expect(outcome).toEqual({ dropped: 1 });
    expect(Object.values(hotkeys.state.toSnapshot()[0].hotkeys)).toEqual([]);
  });

  it('keeps the DOM in step with the model when a file repeats an id', async () => {
    const { hotkeys, slots } = hotkeysHarness([{ id: 1001, title: 'A', artist: 'B', time: '1:00' }]);

    await hotkeys._populateHotkeysImpl({ f1: '1001', f2: '1001' }, '');

    const modelKeys = Object.entries(hotkeys.state.toSnapshot()[0].hotkeys).filter(([, id]) => id === '1001').map(([key]) => key);
    expect(modelKeys).toHaveLength(1);
    const domKeys = Object.entries(slots).filter(([, el]) => el.attrs.get('songid') === '1001').map(([key]) => key);
    expect(domKeys).toEqual(modelKeys);
  });

  it('leaves the tab untouched for an empty file', async () => {
    const { hotkeys } = hotkeysHarness([]);
    hotkeys.state.assign(1, 'f5', '7');

    expect(await hotkeys._populateHotkeysImpl({}, '')).toEqual({ dropped: 0 });
    expect(hotkeys.state.toSnapshot()[0].hotkeys.f5).toBe('7');
    expect(hotkeys.requestProfileStateSave).not.toHaveBeenCalled();
  });
});

describe('legacy file import bridge', () => {
  let handlers;
  let toast;
  let trackEvent;
  let moduleRegistry;

  function bridge(status) {
    handlers = {};
    const events = new Proxy({}, { get: (_t, name) => (handler) => { handlers[name] = handler; } });
    setupMainProcessEventBridge({
      electronAPI: {
        events,
        boards: { getState: async () => ({ success: true, data: { status } }) },
        analytics: { trackEvent }
      },
      moduleRegistry,
      toast
    });
  }

  beforeEach(() => {
    toast = vi.fn();
    trackEvent = vi.fn();
    moduleRegistry = {
      hotkeys: { populateHotkeys: vi.fn(async () => ({ dropped: 2 })) },
      holdingTank: { populateHoldingTank: vi.fn(async () => ({ success: true, dropped: 1 })) }
    };
  });

  it('ignores a load until the board is ready and says why', async () => {
    bridge('loading');
    await handlers.onFkeyLoad({ f1: '1' }, '');
    await handlers.onHoldingTankLoad(['1']);

    expect(moduleRegistry.hotkeys.populateHotkeys).not.toHaveBeenCalled();
    expect(moduleRegistry.holdingTank.populateHoldingTank).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledTimes(2);
    expect(toast.mock.calls[0][0]).toBe('Wait for the board to finish loading, then import again.');
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('imports hotkeys, reports dropped songs and tracks the import', async () => {
    bridge('ready');
    await handlers.onFkeyLoad({ f1: '1' }, 'T');

    expect(moduleRegistry.hotkeys.populateHotkeys).toHaveBeenCalledWith({ f1: '1' }, 'T');
    expect(toast.mock.calls[0][0]).toBe("2 songs in this file aren't in your library.");
    expect(trackEvent).toHaveBeenCalledWith('legacy_file_imported', { kind: 'hotkeys' });
  });

  it('uses the singular message and tracks holding-tank imports', async () => {
    bridge('ready');
    await handlers.onHoldingTankLoad(['1', '2']);

    expect(toast.mock.calls[0][0]).toBe("1 song in this file isn't in your library.");
    expect(trackEvent).toHaveBeenCalledWith('legacy_file_imported', { kind: 'holding_tank' });
  });

  it('does not track an import that found no songs and says so', async () => {
    moduleRegistry.holdingTank.populateHoldingTank = vi.fn(async () => ({ success: false, error: 'No song IDs provided', dropped: 0 }));
    bridge('ready');
    await handlers.onHoldingTankLoad([]);
    expect(toast.mock.calls[0][0]).toBe('This file has no songs to import.');
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('shows no toast when nothing was dropped', async () => {
    moduleRegistry.hotkeys.populateHotkeys = vi.fn(async () => ({ dropped: 0 }));
    bridge('ready');
    await handlers.onFkeyLoad({ f1: '1' }, '');
    expect(toast).not.toHaveBeenCalled();
  });
});
