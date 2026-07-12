import { describe, expect, it, vi } from 'vitest';
import HotkeyState from '../../../src/renderer/modules/hotkeys/hotkey-state.js';

describe('HotkeyState', () => {
  it('always serializes the existing five-tab state.json shape', () => {
    const state = new HotkeyState();
    expect(state.toSnapshot()).toEqual(Array.from({ length: 5 }, (_, index) => ({
      tabNumber: index + 1,
      tabName: null,
      hotkeys: {}
    })));
  });

  it('round-trips profile snapshots without retaining caller-owned objects', () => {
    const snapshot = [
      { tabNumber: 1, tabName: 'Walk-ons', hotkeys: { f1: '17', f12: '99' } },
      { tabNumber: 3, tabName: null, hotkeys: { f4: '42' } }
    ];
    const state = new HotkeyState(snapshot);
    snapshot[0].hotkeys.f1 = 'changed';

    expect(state.toSnapshot()[0]).toEqual({
      tabNumber: 1,
      tabName: 'Walk-ons',
      hotkeys: { f1: '17', f12: '99' }
    });
    expect(state.getAssignment(3, 'F4')).toBe('42');
  });

  it('swaps an existing assignment when a song moves within a tab', () => {
    const state = new HotkeyState();
    state.assign(1, 'f1', 'song-a');
    state.assign(1, 'f2', 'song-b');

    state.assign(1, 'f2', 'song-a');

    expect(state.getAssignment(1, 'f1')).toBe('song-b');
    expect(state.getAssignment(1, 'f2')).toBe('song-a');
  });

  it('moves an assignment when the destination is empty', () => {
    const state = new HotkeyState([{ tabNumber: 1, hotkeys: { f1: '17' } }]);
    state.assign(1, 'f2', '17');
    expect(state.getAssignment(1, 'f1')).toBeNull();
    expect(state.getAssignment(1, 'f2')).toBe('17');
  });

  it('allows the same song on different tabs', () => {
    const state = new HotkeyState();
    state.assign(1, 'f1', '17');
    state.assign(2, 'f1', '17');
    expect(state.getAssignment(1, 'f1')).toBe('17');
    expect(state.getAssignment(2, 'f1')).toBe('17');
  });

  it('supports clearing and restoring the default numeric tab name', () => {
    const state = new HotkeyState([{ tabNumber: 1, tabName: 'Favorites', hotkeys: { f1: '17' } }]);
    state.clear(1, 'f1');
    state.renameTab(1, '  ');
    expect(state.toSnapshot()[0]).toEqual({ tabNumber: 1, tabName: null, hotkeys: {} });
  });

  it('clears a deleted song from every tab', () => {
    const state = new HotkeyState();
    state.assign(1, 'f1', '17');
    state.assign(2, 'f4', '17');
    state.assign(2, 'f5', '18');
    state.clearSong('17');
    expect(state.getAssignment(1, 'f1')).toBeNull();
    expect(state.getAssignment(2, 'f4')).toBeNull();
    expect(state.getAssignment(2, 'f5')).toBe('18');
  });

  it('notifies once for a batch of mutations', () => {
    const state = new HotkeyState();
    const listener = vi.fn();
    state.subscribe(listener);
    state.batch(() => {
      state.assign(1, 'f1', '17');
      state.assign(1, 'f2', '18');
      state.renameTab(1, 'Favorites');
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0][0]).toEqual({
      tabNumber: 1,
      tabName: 'Favorites',
      hotkeys: { f1: '17', f2: '18' }
    });
  });

  it('continues notifying when a subscriber throws', () => {
    const state = new HotkeyState();
    const listener = vi.fn();
    state.subscribe(() => { throw new Error('render failed'); });
    state.subscribe(listener);
    state.assign(1, 'f1', '17');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid direct mutations while tolerating unknown snapshot fields', () => {
    const state = new HotkeyState([{ tabNumber: 8, hotkeys: { f1: 'ignored' } }]);
    expect(() => state.assign(0, 'f1', '17')).toThrow(RangeError);
    expect(() => state.assign(1, 'f13', '17')).toThrow(RangeError);
    expect(() => state.assign(1, 'f1', '')).toThrow(TypeError);
    expect(state.toSnapshot().flatMap(tab => Object.values(tab.hotkeys))).toEqual([]);
  });
});
