import { describe, expect, it, vi } from 'vitest';
import { handlePlaybackStarted } from '../../../src/renderer/modules/audio/playback-start.js';

describe('playback start orchestration', () => {
  it('starts fade-in, animation tracking, presentation, and probe setup', () => {
    const sound = { fade: vi.fn() };
    const howlerContext = {};
    const sharedState = { set: vi.fn() };
    const animationCallback = vi.fn();
    const requestAnimationFrame = vi.fn(() => 17);
    const updateTimeTracker = vi.fn();
    const presentPlayback = vi.fn();
    const ensureAudioProbe = vi.fn();
    const presentation = { songId: 3 };

    handlePlaybackStarted({
      sound, howlerContext, crossfade: true, targetVolume: 0.7, durationMs: 2000,
      sharedState, requestAnimationFrame, updateTimeTracker,
      presentPlayback, presentation, ensureAudioProbe
    });

    expect(sound.fade).toHaveBeenCalledWith(0, 0.7, 2000);
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    expect(sharedState.set).toHaveBeenCalledWith('globalAnimation', 17);
    expect(presentPlayback).toHaveBeenCalledWith(presentation);
    expect(ensureAudioProbe).toHaveBeenCalledOnce();
    expect(animationCallback).not.toHaveBeenCalled();
  });

  it('does not require crossfade or probe instrumentation', () => {
    const sound = { fade: vi.fn() };
    handlePlaybackStarted({
      sound, howlerContext: {}, crossfade: false, targetVolume: 1, durationMs: 0,
      sharedState: { set: vi.fn() }, requestAnimationFrame: () => 1,
      updateTimeTracker: () => {}, presentPlayback: () => {}, presentation: {}
    });
    expect(sound.fade).not.toHaveBeenCalled();
  });
});
