import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolvePlaybackTrigger, trackSongPlayed } from '../../../src/renderer/modules/audio/playback-analytics.js';
import { recordSearch, resetSearchTracker } from '../../../src/renderer/modules/analytics/search-tracker.js';

function row({ songid = '7', container = null } = {}) {
  return {
    getAttribute: (name) => (name === 'songid' ? songid : null),
    closest: (selector) => (selector === container ? {} : null),
  };
}

describe('resolvePlaybackTrigger', () => {
  it('falls back to hotkey when there is no selected row', () => {
    expect(resolvePlaybackTrigger({ selectedRow: null })).toBe('hotkey');
  });

  it('falls back to hotkey when the selected row has no song', () => {
    expect(resolvePlaybackTrigger({ selectedRow: row({ songid: null }) })).toBe('hotkey');
  });

  it('reports holding_tank for a holding tank row in storage mode', () => {
    const selectedRow = row({ container: '#holding-tank-column' });
    expect(resolvePlaybackTrigger({ selectedRow, holdingTankMode: 'storage' })).toBe('holding_tank');
  });

  it('reports playlist for a holding tank row in playlist mode', () => {
    const selectedRow = row({ container: '#holding-tank-column' });
    expect(resolvePlaybackTrigger({ selectedRow, holdingTankMode: 'playlist' })).toBe('playlist');
  });

  it('reports hotkey for a selected hotkey row', () => {
    expect(resolvePlaybackTrigger({ selectedRow: row({ container: '.hotkeys' }) })).toBe('hotkey');
  });

  it('reports search_result for any other selected row', () => {
    expect(resolvePlaybackTrigger({ selectedRow: row() })).toBe('search_result');
  });
});

describe('trackSongPlayed', () => {
  const trackEvent = vi.fn();

  beforeEach(() => {
    trackEvent.mockClear();
    globalThis.window = { secureElectronAPI: { analytics: { trackEvent } } };
    resetSearchTracker();
  });

  it('sends song_played with the trigger method', () => {
    trackSongPlayed('hotkey');
    expect(trackEvent).toHaveBeenCalledWith('song_played', { trigger_method: 'hotkey' });
  });

  it('labels plays without a trigger as unknown', () => {
    trackSongPlayed();
    expect(trackEvent).toHaveBeenCalledWith('song_played', { trigger_method: 'unknown' });
  });

  it('sends a pending search before the play so funnels see search first', () => {
    recordSearch({ signature: 'abc', resultCount: 3, source: 'live' });

    trackSongPlayed('search_result');

    expect(trackEvent.mock.calls.map(([name]) => name)).toEqual(['search_performed', 'song_played']);
  });

  it('is a no-op when analytics is unavailable', () => {
    globalThis.window = {};
    expect(() => trackSongPlayed('hotkey')).not.toThrow();
  });
});
