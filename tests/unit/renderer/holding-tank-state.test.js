import { describe, expect, it, vi } from 'vitest';
import HoldingTankState from '../../../src/renderer/modules/holding-tank/holding-tank-state.js';

describe('HoldingTankState', () => {
  it('round-trips the existing five-tab snapshot shape', () => {
    const state = new HoldingTankState([
      { tabNumber: 1, tabName: 'Act One', songIds: ['17', 18, '17'] }
    ]);
    expect(state.toSnapshot()[0]).toEqual({
      tabNumber: 1,
      tabName: 'Act One',
      songIds: ['17', '18', '17']
    });
    expect(state.toSnapshot()).toHaveLength(5);
  });

  it('supports ordered insertion and removal', () => {
    const state = new HoldingTankState();
    state.add(2, '17');
    state.add(2, '19');
    state.add(2, '18', 1);
    expect(state.toSnapshot()[1].songIds).toEqual(['17', '18', '19']);
    expect(state.removeAt(2, 1)).toBe('18');
    expect(state.toSnapshot()[1].songIds).toEqual(['17', '19']);
  });

  it('clears and renames tabs without exposing internal arrays', () => {
    const state = new HoldingTankState([{ tabNumber: 1, songIds: ['17'] }]);
    const listener = vi.fn();
    state.subscribe(listener);
    state.renameTab(1, '  Preset  ');
    state.clearTab(1);
    const snapshot = state.toSnapshot();
    snapshot[0].songIds.push('changed');
    expect(state.toSnapshot()[0]).toEqual({ tabNumber: 1, tabName: 'Preset', songIds: [] });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid direct mutations and ignores invalid snapshot tabs', () => {
    const state = new HoldingTankState([{ tabNumber: 8, songIds: ['17'] }]);
    expect(() => state.add(0, '17')).toThrow(RangeError);
    expect(() => state.add(1, '')).toThrow(TypeError);
    expect(() => state.add(1, '17', 2)).toThrow(RangeError);
    expect(state.toSnapshot().flatMap(tab => tab.songIds)).toEqual([]);
  });
});
