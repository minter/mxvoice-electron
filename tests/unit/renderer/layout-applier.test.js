import { beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.window = { debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } };

const { applyLayout, fetchSongsById } = await import('../../../src/renderer/modules/shows/layout-applier.js');

function fakeElement(id = '', classes = [], attributes = {}) {
  const classSet = new Set(classes);
  const attrs = new Map(Object.entries(attributes));
  const element = {
    id,
    classList: {
      add: (...names) => names.forEach(name => classSet.add(name)),
      remove: (...names) => names.forEach(name => classSet.delete(name)),
      contains: name => classSet.has(name)
    },
    getAttribute: name => attrs.get(name) ?? null,
    setAttribute: (name, value) => attrs.set(name, String(value)),
    // Like the DOM, removing the id attribute clears the id property
    removeAttribute: name => (name === 'id' ? (element.id = '') : attrs.delete(name))
  };
  return element;
}

function fakeDocument(elements) {
  return {
    getElementById: id => elements.find(element => element.id === id) || null,
    querySelectorAll(selector) {
      const attr = selector.match(/^\[([\w-]+)\]$/);
      if (attr) return elements.filter(element => element.getAttribute(attr[1]) !== null);
      const match = selector.match(/^\.([\w-]+)$/);
      if (!match) throw new Error(`Unexpected selector ${selector}`);
      return elements.filter(element => element.classList.contains(match[1]));
    }
  };
}

function fakeSharedState(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get: vi.fn(key => values.get(key)),
    set: vi.fn((key, value) => values.set(key, value)),
    values
  };
}

const layout = {
  hotkeys: [{ tabNumber: 1, tabName: null, hotkeys: { f1: '1', f2: '2' } }],
  holdingTank: [{ tabNumber: 2, tabName: 'Act Two', songIds: ['2', '3', '9'] }],
  selected: { hotkeyTab: 3, holdingTankTab: 2 }
};

function createDeps(overrides = {}) {
  const calls = [];
  const hotkeys = {
    collectSongIds: vi.fn(snapshot => snapshot.flatMap(tab => Object.values(tab.hotkeys))),
    applyHotkeySnapshot: vi.fn(() => { calls.push('hotkeys'); return { dropped: 0 }; })
  };
  const holdingTank = {
    collectSongIds: vi.fn(snapshot => snapshot.flatMap(tab => tab.songIds)),
    applyHoldingTankSnapshot: vi.fn(() => { calls.push('holdingTank'); return { dropped: 1 }; })
  };
  const getSongsByIds = vi.fn(async ids => ({
    success: true,
    data: ids.filter(id => id !== '9').map(id => ({ id: Number(id), title: `Song ${id}` }))
  }));
  const playing = fakeElement('', ['list-group-item', 'now_playing'], { songid: '2' });
  const selectedRow = fakeElement('selected_row', ['list-group-item'], { songid: '3' });
  const activeHotkey = fakeElement('f1_hotkey', ['list-group-item', 'active-hotkey', 'selected-row'], { songid: '1' });
  const nowPlaying = fakeElement('song_now_playing', [], { songid: '2' });
  const doc = fakeDocument([playing, selectedRow, activeHotkey, nowPlaying]);
  const win = { currentSelectedHotkey: 'f1_hotkey' };
  const sharedState = fakeSharedState({ showGeneration: 4, sound: { id: 'sound' }, autoplay: true });
  const showTab = vi.fn();
  return {
    calls,
    elements: { playing, selectedRow, activeHotkey, nowPlaying },
    deps: { hotkeys, holdingTank, getSongsByIds, sharedState, showTab, document: doc, window: win, ...overrides }
  };
}

describe('applyLayout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches songs once, then applies both collections in one synchronous step', async () => {
    const { deps, calls } = createDeps();
    let microtaskRan = false;
    deps.hotkeys.applyHotkeySnapshot.mockImplementation(() => {
      queueMicrotask(() => { microtaskRan = true; });
      calls.push('hotkeys');
      return { dropped: 0 };
    });
    deps.holdingTank.applyHoldingTankSnapshot.mockImplementation(() => {
      calls.push(`holdingTank:${microtaskRan}`);
      return { dropped: 1 };
    });
    deps.sharedState.set.mockImplementation((key, value) => {
      calls.push(`${key}:${microtaskRan}`);
      deps.sharedState.values.set(key, value);
    });

    await applyLayout(layout, deps);

    expect(deps.getSongsByIds).toHaveBeenCalledTimes(1);
    expect(deps.getSongsByIds.mock.calls[0][0].sort()).toEqual(['1', '2', '3', '9']);
    expect(calls).toEqual(['hotkeys', 'holdingTank:false', 'showGeneration:false']);
    const songsById = deps.hotkeys.applyHotkeySnapshot.mock.calls[0][1];
    expect(deps.hotkeys.applyHotkeySnapshot).toHaveBeenCalledWith(layout.hotkeys, songsById);
    expect(deps.holdingTank.applyHoldingTankSnapshot).toHaveBeenCalledWith(layout.holdingTank, songsById);
    expect([...songsById.keys()].sort()).toEqual(['1', '2', '3']);
    expect(deps.sharedState.values.get('showGeneration')).toBe(5);
  });

  it('clears now_playing, selected_row and active-hotkey', async () => {
    const { deps, elements } = createDeps();

    await applyLayout(layout, deps);

    expect(elements.playing.classList.contains('now_playing')).toBe(false);
    expect(elements.selectedRow.id).toBe('');
    expect(elements.activeHotkey.classList.contains('active-hotkey')).toBe(false);
    expect(elements.activeHotkey.classList.contains('selected-row')).toBe(false);
    expect(deps.window.currentSelectedHotkey).toBeNull();
  });

  it('clears the context-menu target and closes the song context menu', async () => {
    const target = fakeElement('f3_hotkey', ['list-group-item'], { songid: '5', 'data-context-target': 'true' });
    const dispatchEvent = vi.fn();
    const { deps } = createDeps({
      document: fakeDocument([target]),
      window: { currentSelectedHotkey: null, dispatchEvent, CustomEvent: globalThis.CustomEvent }
    });

    await applyLayout(layout, deps);

    expect(target.getAttribute('data-context-target')).toBeNull();
    expect(target.id).toBe('f3_hotkey');
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect(dispatchEvent.mock.calls[0][0].type).toBe('mxv-context-menu-dismiss');
  });

  it('does not touch sharedState.sound or #song_now_playing', async () => {
    const { deps, elements } = createDeps();
    const sound = deps.sharedState.values.get('sound');

    await applyLayout(layout, deps);

    expect(deps.sharedState.set).toHaveBeenCalledTimes(1);
    expect(deps.sharedState.set).toHaveBeenCalledWith('showGeneration', 5);
    expect(deps.sharedState.values.get('sound')).toBe(sound);
    expect(deps.sharedState.values.get('autoplay')).toBe(true);
    expect(elements.nowPlaying.id).toBe('song_now_playing');
    expect(elements.nowPlaying.getAttribute('songid')).toBe('2');
  });

  it('returns the number of ids missing from the library', async () => {
    const { deps } = createDeps({
      getSongsByIds: vi.fn(async () => ({ success: true, data: [{ id: 1 }] }))
    });

    // '2' is in both collections and counts once; '2', '3' and '9' are missing.
    await expect(applyLayout(layout, deps)).resolves.toEqual({ dropped: 3, droppedIds: ['2', '3', '9'] });
  });

  it('selects the saved tabs', async () => {
    const { deps } = createDeps();

    await applyLayout(layout, deps);

    expect(deps.showTab).toHaveBeenCalledWith('#hotkey_tabs li:nth-child(3) a', expect.any(Object));
    expect(deps.showTab).toHaveBeenCalledWith('#holding_tank_tabs li:nth-child(2) a', expect.any(Object));
  });

  it('defaults to the first tabs and generation 1 when nothing is set', async () => {
    const { deps } = createDeps({ sharedState: fakeSharedState() });

    await applyLayout({ hotkeys: [], holdingTank: [] }, deps);

    expect(deps.getSongsByIds).not.toHaveBeenCalled();
    expect(deps.showTab).toHaveBeenCalledWith('#hotkey_tabs li:nth-child(1) a', expect.any(Object));
    expect(deps.showTab).toHaveBeenCalledWith('#holding_tank_tabs li:nth-child(1) a', expect.any(Object));
    expect(deps.sharedState.values.get('showGeneration')).toBe(1);
  });

  it.each([
    ['rejects', () => Promise.reject(new Error('db down'))],
    ['reports failure', async () => ({ success: false, error: 'db down' })],
    ['returns no rows', async () => ({ success: true, data: { not: 'rows' } })]
  ])('changes nothing when the song lookup %s', async (_label, lookup) => {
    const { deps, elements } = createDeps({ getSongsByIds: vi.fn(lookup) });

    await expect(applyLayout(layout, deps)).rejects.toThrow();

    expect(deps.hotkeys.applyHotkeySnapshot).not.toHaveBeenCalled();
    expect(deps.holdingTank.applyHoldingTankSnapshot).not.toHaveBeenCalled();
    expect(deps.showTab).not.toHaveBeenCalled();
    expect(deps.sharedState.set).not.toHaveBeenCalled();
    expect(elements.playing.classList.contains('now_playing')).toBe(true);
    expect(elements.selectedRow.id).toBe('selected_row');
    expect(elements.activeHotkey.classList.contains('active-hotkey')).toBe(true);
    expect(deps.window.currentSelectedHotkey).toBe('f1_hotkey');
  });
});

describe('fetchSongsById', () => {
  it('looks every id up in one query and keys the rows by string id', async () => {
    const getSongsByIds = vi.fn(async () => ({ success: true, data: [{ id: 7, title: 'A' }] }));
    const songs = await fetchSongsById(['7', '8'], getSongsByIds);
    expect(getSongsByIds).toHaveBeenCalledOnce();
    expect(getSongsByIds).toHaveBeenCalledWith(['7', '8']);
    expect([...songs.keys()]).toEqual(['7']);
  });

  it('makes no query for no ids, even without a lookup', async () => {
    await expect(fetchSongsById([], undefined)).resolves.toEqual(new Map());
  });

  it('throws on a failed, malformed or missing lookup', async () => {
    await expect(fetchSongsById(['1'], async () => ({ success: false, error: 'db closed' }))).rejects.toThrow('db closed');
    await expect(fetchSongsById(['1'], async () => ({ success: true, data: 'nope' }))).rejects.toThrow('song metadata');
    await expect(fetchSongsById(['1'], undefined)).rejects.toThrow('unavailable');
  });
});
