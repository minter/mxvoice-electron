import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordPlay = vi.fn();
const loadSongForPlayback = vi.fn();
const resolveAudioSource = vi.fn();
const sounds = [];

vi.mock('../../../src/renderer/modules/shows/played-counts.js', () => ({ recordPlay, default: { recordPlay } }));
vi.mock('../../../src/renderer/modules/audio/playback-song-loader.js', () => ({ loadSongForPlayback }));
vi.mock('../../../src/renderer/modules/audio/audio-source-resolver.js', () => ({ resolveAudioSource }));
vi.mock('../../../src/renderer/modules/audio/playback-error-presenter.js', () => ({ showMissingAudioFile: vi.fn() }));
// The UI side of a start is covered elsewhere
vi.mock('../../../src/renderer/modules/audio/playback-start.js', () => ({ handlePlaybackStarted: vi.fn() }));
vi.mock('../../../src/renderer/modules/preferences/profile-preference-adapter.js', () => ({
  getPreference: vi.fn(async () => ({ success: true, value: 0 })),
}));

/** A Howl double: play() fires onplay as Howler does, unless the file failed to load. */
function fakeHowl(options) {
  const sound = {
    options,
    failed: false,
    isPlaying: false,
    play: vi.fn(() => {
      if (sound.failed) {
        options.onloaderror?.call(sound, 1, 'decode');
        return undefined;
      }
      sound.isPlaying = true;
      options.onplay?.call(sound);
      return 1;
    }),
    playing: () => sound.isPlaying,
    state: () => (sound.failed ? 'unloaded' : 'loaded'),
    seek: vi.fn(),
    unload: vi.fn(() => { sound.isPlaying = false; }),
    fade: vi.fn(),
    volume: vi.fn(() => 1),
    on: vi.fn(),
    off: vi.fn(),
    end: () => { sound.isPlaying = false; options.onend?.call(sound); },
  };
  if (nextLoadFails) {
    sound.failed = true;
    nextLoadFails = false;
  }
  sounds.push(sound);
  return sound;
}
let nextLoadFails = false;
vi.mock('../../../src/renderer/modules/audio/audio-utils.js', () => ({
  createHowl: (options) => fakeHowl(options),
  howlerUtils: { updateTimeTracker: vi.fn() },
}));

globalThis.requestAnimationFrame = vi.fn(() => 1);
globalThis.cancelAnimationFrame = vi.fn();
globalThis.window = {
  secureElectronAPI: { analytics: { trackEvent: vi.fn() }, store: { get: async () => ({ success: true, value: '/music' }) } },
  debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
};
const nextRow = { getAttribute: () => '8', classList: { add: vi.fn(), remove: vi.fn() }, id: '' };
const nowPlaying = { classList: { add: vi.fn(), remove: vi.fn() }, getAttribute: () => '7', nextElementSibling: nextRow };
globalThis.document = {
  querySelector: vi.fn(() => nowPlaying),
  getElementById: vi.fn(() => null),
  querySelectorAll: () => [],
};

const sharedState = (await import('../../../src/renderer/modules/shared-state.js')).default;
const manager = await import('../../../src/renderer/modules/audio/audio-manager.js');

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function play(id, options) {
  await manager.playSongFromId(id, options);
  await vi.waitFor(() => expect(sounds.length).toBeGreaterThan(0));
  await settle();
}

describe('played counts at playback start', () => {
  beforeEach(() => {
    recordPlay.mockClear();
    sounds.length = 0;
    sharedState.reset();
    loadSongForPlayback.mockReset();
    resolveAudioSource.mockReset();
    loadSongForPlayback.mockImplementation(async (id) => ({ success: true, filename: `${id}.mp3`, row: {} }));
    resolveAudioSource.mockResolvedValue({ success: true, source: 'file:///music/a.mp3' });
  });

  it('counts a play once, when its playback starts, and not again on resume', async () => {
    await play('7', { trigger_method: 'hotkey' });
    expect(recordPlay.mock.calls).toEqual([['7']]);

    // A pause and resume fires Howler's play event again
    sounds[0].options.onplay.call(sounds[0]);
    expect(recordPlay).toHaveBeenCalledTimes(1);

    // Ending without autoplay starts nothing
    sounds[0].end();
    expect(recordPlay).toHaveBeenCalledTimes(1);
  });

  it('does not count a song whose file fails to load', async () => {
    nextLoadFails = true;
    await manager.playSongFromId('7', { trigger_method: 'hotkey' });
    await vi.waitFor(() => expect(sounds).toHaveLength(1));
    // ensureAudioContextAndPlay waits 100ms before giving up on a failed play
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(recordPlay).not.toHaveBeenCalled();
  });

  it('does not count a song that cannot be loaded or whose file is missing', async () => {
    loadSongForPlayback.mockResolvedValueOnce({ success: false, error: 'Song not found' });
    await manager.playSongFromId('7', {});
    resolveAudioSource.mockResolvedValueOnce({ success: false, reason: 'missing', error: 'ENOENT' });
    await manager.playSongFromId('8', {});
    await settle();
    expect(sounds).toHaveLength(0);
    expect(recordPlay).not.toHaveBeenCalled();
  });

  it('an autoplay advance counts the next song once', async () => {
    sharedState.set('autoplay', true);
    sharedState.set('holdingTankMode', 'playlist');
    await play('7', { trigger_method: 'holding_tank' });

    sounds[0].end();
    await vi.waitFor(() => expect(sounds).toHaveLength(2));
    await settle();

    expect(recordPlay.mock.calls).toEqual([['7'], ['8']]);
  });

  it('a crossfade counts the incoming song once, and the outgoing one never again', async () => {
    sharedState.set('autoplay', true);
    sharedState.set('holdingTankMode', 'playlist');
    await play('7', { trigger_method: 'holding_tank' });
    // Set after the first play, which caches the (zero) preference
    sharedState.set('crossfadeSeconds', 2);

    manager.triggerEarlyCrossfade(1.5);
    await vi.waitFor(() => expect(sounds).toHaveLength(2));
    await settle();
    expect(sounds[1].options.volume).toBe(0);
    // The outgoing sound ends after its fade: it is stale and starts nothing
    sounds[0].end();
    await settle();

    expect(recordPlay.mock.calls).toEqual([['7'], ['8']]);
  });
});
