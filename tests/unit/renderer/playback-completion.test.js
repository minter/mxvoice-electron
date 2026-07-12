import { describe, expect, it, vi } from 'vitest';
import { handlePlaybackCompleted } from '../../../src/renderer/modules/audio/playback-completion.js';

const state = (values) => {
  const data = new Map(Object.entries(values));
  return { get: (key) => data.get(key) };
};

describe('playback completion', () => {
  it('unloads stale crossfaded audio without resetting active playback', () => {
    const sound = { unload: vi.fn() };
    const onSongEnded = vi.fn();
    expect(handlePlaybackCompleted({
      sound, sharedState: state({ sound: {} }), onSongEnded,
      replaySong: vi.fn(), autoplayNext: vi.fn()
    })).toBe('stale');
    expect(sound.unload).toHaveBeenCalledOnce();
    expect(onSongEnded).not.toHaveBeenCalled();
  });

  it('prioritizes replay for an active looping song', () => {
    const sound = {};
    const replaySong = vi.fn();
    expect(handlePlaybackCompleted({
      sound, songId: '42',
      sharedState: state({ sound, loop: true, autoplay: true, holdingTankMode: 'playlist' }),
      onSongEnded: vi.fn(), replaySong, autoplayNext: vi.fn()
    })).toBe('loop');
    expect(replaySong).toHaveBeenCalledWith('42');
  });

  it('advances playlist autoplay and otherwise stops', () => {
    const sound = {};
    const autoplayNext = vi.fn();
    expect(handlePlaybackCompleted({
      sound, sharedState: state({ sound, loop: false, autoplay: true, holdingTankMode: 'playlist' }),
      onSongEnded: vi.fn(), replaySong: vi.fn(), autoplayNext
    })).toBe('autoplay');
    expect(autoplayNext).toHaveBeenCalledOnce();

    expect(handlePlaybackCompleted({
      sound, sharedState: state({ sound, loop: false, autoplay: false, holdingTankMode: 'playlist' }),
      onSongEnded: vi.fn(), replaySong: vi.fn(), autoplayNext: vi.fn()
    })).toBe('stop');
  });
});
