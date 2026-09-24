import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackEvent = vi.fn();
const loadSongForPlayback = vi.fn();

vi.mock('../../../src/renderer/modules/audio/playback-song-loader.js', () => ({ loadSongForPlayback }));
vi.mock('../../../src/renderer/modules/preferences/profile-preference-adapter.js', () => ({
  getPreference: vi.fn(async () => ({ success: true, value: 0 })),
}));

globalThis.window = {
  secureElectronAPI: {
    analytics: { trackEvent },
    // playSongWithFilename's music-directory lookup; never resolves so playback stops here
    store: { get: () => new Promise(() => {}) },
  },
  debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
};
globalThis.document = { querySelector: () => null, getElementById: () => null, querySelectorAll: () => [] };

const manager = await import('../../../src/renderer/modules/audio/audio-manager.js');

describe('playSongFromId song_played tracking', () => {
  beforeEach(() => {
    trackEvent.mockClear();
    loadSongForPlayback.mockReset();
  });

  it('tracks the trigger method once the song loads', async () => {
    loadSongForPlayback.mockResolvedValue({ success: true, filename: 'a.mp3', row: {} });

    await manager.playSongFromId('7', { trigger_method: 'hotkey' });

    expect(trackEvent).toHaveBeenCalledWith('song_played', { trigger_method: 'hotkey' });
  });

  it('does not track when the song cannot be loaded', async () => {
    loadSongForPlayback.mockResolvedValue({ success: false, error: 'missing' });

    await manager.playSongFromId('7', { trigger_method: 'hotkey' });

    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('does not track without a song id', async () => {
    await manager.playSongFromId(null, { trigger_method: 'hotkey' });

    expect(trackEvent).not.toHaveBeenCalled();
  });
});
