import { describe, expect, it, vi } from 'vitest';
import { fakeCreateElement, makeTextNode } from '../../utils/fake-text-node.js';

globalThis.window = { debugLog: {} };
globalThis.document = { querySelectorAll: () => [], querySelector: () => null, getElementById: () => null, createElement: fakeCreateElement() };

const { HotkeysModule } = await import('../../../src/renderer/modules/hotkeys/index.js');
const { default: HotkeyState } = await import('../../../src/renderer/modules/hotkeys/hotkey-state.js');

function slot(key) {
  const span = makeTextNode();
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

describe('hotkey tab file load onto the current tab', () => {
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

  it('leaves the tab untouched when none of the file\'s ids are in the library', async () => {
    const { hotkeys, slots } = hotkeysHarness([]);
    hotkeys.state.assign(1, 'f5', '7');
    slots.f5.setAttribute('songid', '7');

    const outcome = await hotkeys._populateHotkeysImpl({ f1: '999', f2: '998' }, 'Other Show');

    // success: false makes the bridge say the file has no songs, untracked
    expect(outcome).toMatchObject({ success: false, dropped: 2 });
    expect(hotkeys.state.toSnapshot()[0]).toMatchObject({ tabName: null, hotkeys: { f5: '7' } });
    expect(slots.f5.attrs.get('songid')).toBe('7');
    expect(hotkeys.requestProfileStateSave).not.toHaveBeenCalled();
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
