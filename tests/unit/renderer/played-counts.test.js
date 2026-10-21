import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordPlay = vi.fn(async () => ({ success: true, data: { count: 1 } }));
const clearPlayed = vi.fn(async () => ({ success: true, data: { count: 0 } }));
const events = [];
globalThis.window = new EventTarget();
window.secureElectronAPI = { shows: { recordPlay, clearPlayed } };
window.debugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
window.addEventListener('played-counts-changed', (event) => events.push(event.detail));

const played = await import('../../../src/renderer/modules/shows/played-counts.js');

describe('played counts', () => {
  beforeEach(() => {
    played.load({});
    events.length = 0;
    vi.clearAllMocks();
  });

  it('recordPlay counts per song, tells main, and dispatches the changed song', () => {
    expect(played.count('12')).toBe(0);
    played.recordPlay('12');
    played.recordPlay(12);
    played.recordPlay('7');
    expect(played.count('12')).toBe(2);
    expect(played.count(7)).toBe(1);
    expect(played.hasAny()).toBe(true);
    expect(recordPlay.mock.calls).toEqual([['12'], ['12'], ['7']]);
    expect(events).toEqual([{ songIds: ['12'] }, { songIds: ['12'] }, { songIds: ['7'] }]);
  });

  it('ignores an id that is not a song id', () => {
    for (const bad of [null, undefined, '', 'abc', '1x', -1, 1.5]) played.recordPlay(bad);
    expect(recordPlay).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('clear removes one song; clearing an unplayed song does nothing', () => {
    played.recordPlay('12');
    played.recordPlay('7');
    events.length = 0;
    played.clear('12');
    expect(played.count('12')).toBe(0);
    expect(played.count('7')).toBe(1);
    expect(clearPlayed).toHaveBeenCalledWith('12');
    expect(events).toEqual([{ songIds: ['12'] }]);
    played.clear('12');
    expect(clearPlayed).toHaveBeenCalledTimes(1);
  });

  it('clearAll clears every count once, naming the songs it cleared', () => {
    played.recordPlay('12');
    played.recordPlay('7');
    events.length = 0;
    played.clearAll();
    expect(played.hasAny()).toBe(false);
    expect(clearPlayed).toHaveBeenCalledWith(null);
    expect(events).toEqual([{ songIds: ['12', '7'] }]);
    played.clearAll();
    expect(clearPlayed).toHaveBeenCalledTimes(1);
  });

  it('load replaces the counts without telling main, keeping valid entries only', () => {
    played.recordPlay('99');
    vi.clearAllMocks();
    events.length = 0;
    played.load({ 12: 3, 7: 1, abc: 2, 5: 0, 4: -1, 3: 1.5 });
    expect(played.count('12')).toBe(3);
    expect(played.count('7')).toBe(1);
    expect(played.count('99')).toBe(0);
    expect(played.count('abc')).toBe(0);
    expect(played.count('5')).toBe(0);
    expect(recordPlay).not.toHaveBeenCalled();
    expect(clearPlayed).not.toHaveBeenCalled();
    // Everything may have changed
    expect(events).toEqual([{ songIds: null }]);
    played.load(null);
    expect(played.hasAny()).toBe(false);
  });

  it('a failed or missing IPC never breaks counting', async () => {
    recordPlay.mockRejectedValueOnce(new Error('gone'));
    played.recordPlay('12');
    await Promise.resolve();
    await Promise.resolve();
    expect(played.count('12')).toBe(1);
    expect(window.debugLog.warn).toHaveBeenCalled();
    const api = window.secureElectronAPI;
    window.secureElectronAPI = undefined;
    played.recordPlay('12');
    played.clearAll();
    window.secureElectronAPI = api;
    expect(played.hasAny()).toBe(false);
  });
});
