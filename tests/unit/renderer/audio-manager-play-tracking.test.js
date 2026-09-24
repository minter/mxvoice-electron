import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackEvent = vi.fn();
const loadSongForPlayback = vi.fn();
const resolveAudioSource = vi.fn();

vi.mock('../../../src/renderer/modules/audio/playback-song-loader.js', () => ({ loadSongForPlayback }));
vi.mock('../../../src/renderer/modules/audio/audio-source-resolver.js', () => ({ resolveAudioSource }));
vi.mock('../../../src/renderer/modules/audio/playback-error-presenter.js', () => ({ showMissingAudioFile: vi.fn() }));
// Stop playback right after the play is counted; sound creation is covered elsewhere
vi.mock('../../../src/renderer/modules/audio/playback-policy.js', () => ({
  calculatePlaybackVolume: () => { throw new Error('stop after tracking'); },
  getCrossfadePolicy: vi.fn(),
  getTrackBounds: vi.fn(),
}));
vi.mock('../../../src/renderer/modules/preferences/profile-preference-adapter.js', () => ({
  getPreference: vi.fn(async () => ({ success: true, value: 0 })),
}));

globalThis.window = {
  secureElectronAPI: {
    analytics: { trackEvent },
    store: { get: async () => ({ success: true, value: '/music' }) },
  },
  debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
};
globalThis.document = { querySelector: () => null, getElementById: () => null, querySelectorAll: () => [] };

const manager = await import('../../../src/renderer/modules/audio/audio-manager.js');

describe('playSongFromId song_played tracking', () => {
  beforeEach(() => {
    trackEvent.mockClear();
    loadSongForPlayback.mockReset();
    resolveAudioSource.mockReset();
  });

  it('tracks the trigger method once the audio file resolves', async () => {
    loadSongForPlayback.mockResolvedValue({ success: true, filename: 'a.mp3', row: {} });
    resolveAudioSource.mockResolvedValue({ success: true, source: 'file:///music/a.mp3' });

    await manager.playSongFromId('7', { trigger_method: 'hotkey' });

    await vi.waitFor(() => expect(trackEvent).toHaveBeenCalledWith('song_played', { trigger_method: 'hotkey' }));
  });

  it('does not track a song whose audio file is missing', async () => {
    loadSongForPlayback.mockResolvedValue({ success: true, filename: 'gone.mp3', row: { title: 'Gone' } });
    resolveAudioSource.mockResolvedValue({ success: false, reason: 'missing', error: 'ENOENT' });

    await manager.playSongFromId('7', { trigger_method: 'hotkey' });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(resolveAudioSource).toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
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
