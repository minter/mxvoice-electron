import { describe, expect, it, vi } from 'vitest';
import { createPlaybackSound } from '../../../src/renderer/modules/audio/playback-sound-factory.js';

describe('playback sound factory', () => {
  it('builds a Howl with the requested source, volume, and mute state', () => {
    const createHowl = vi.fn((options) => ({ options }));
    const sound = createPlaybackSound({
      createHowl, source: ['/music/song.mp3'], volume: 0.4, muted: true
    });
    expect(createHowl).toHaveBeenCalledWith(expect.objectContaining({
      src: ['/music/song.mp3'], volume: 0.4, mute: true
    }));
    expect(sound.options).toBeDefined();
  });

  it('preserves Howler callback context for playback lifecycle handlers', () => {
    let options;
    const context = { duration: () => 10, state: () => 'loaded' };
    const onPlay = vi.fn(function () { expect(this).toBe(context); });
    const onEnd = vi.fn(function () { expect(this).toBe(context); });
    createPlaybackSound({ createHowl: (value) => { options = value; }, source: [], onPlay, onEnd });

    options.onplay.call(context);
    options.onend.call(context);
    expect(onPlay).toHaveBeenCalledOnce();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('logs load and playback errors with the source', () => {
    let options;
    const debugLog = { info: vi.fn(), error: vi.fn() };
    createPlaybackSound({ createHowl: (value) => { options = value; }, source: ['bad.mp3'], debugLog });
    options.onloaderror(4, 'load failed');
    options.onplayerror(5, 'play failed');
    expect(debugLog.error).toHaveBeenCalledTimes(2);
    expect(debugLog.error).toHaveBeenCalledWith('Sound load error', expect.objectContaining({ src: ['bad.mp3'] }));
  });
});
