import { describe, expect, it, vi } from 'vitest';
import {
  prepareCrossfadeTransition,
  startCrossfadeIn
} from '../../../src/renderer/modules/audio/crossfade-transition.js';

function createState(values) {
  const state = new Map(Object.entries(values));
  return { get: (key) => state.get(key), set: (key, value) => state.set(key, value), state };
}

describe('crossfade transition', () => {
  it('fades a playing sound and releases it when the fade completes', () => {
    let fadeHandler;
    const sound = {
      playing: () => true,
      off: vi.fn(),
      on: vi.fn((event, handler) => { fadeHandler = handler; }),
      fade: vi.fn(),
      volume: () => 0.8,
      unload: vi.fn()
    };
    const sharedState = createState({ sound, globalAnimation: 12 });
    const cancelAnimationFrame = vi.fn();

    prepareCrossfadeTransition({ sharedState, durationMs: 2000, cancelAnimationFrame });
    expect(sound.fade).toHaveBeenCalledWith(0.8, 0, 2000);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(12);
    fadeHandler();
    expect(sound.unload).toHaveBeenCalledOnce();
    expect(sharedState.get('outgoingSound')).toBeNull();
  });

  it('unloads an inactive outgoing sound immediately', () => {
    const sound = { playing: () => false, unload: vi.fn() };
    prepareCrossfadeTransition({
      sharedState: createState({ sound }), durationMs: 1000, cancelAnimationFrame: vi.fn()
    });
    expect(sound.unload).toHaveBeenCalledOnce();
  });

  it('starts a fade-in only for a positive duration', () => {
    const sound = { fade: vi.fn() };
    expect(startCrossfadeIn({ sound, targetVolume: 0.6, durationMs: 1500 })).toBe(true);
    expect(sound.fade).toHaveBeenCalledWith(0, 0.6, 1500);
    expect(startCrossfadeIn({ sound, targetVolume: 0.6, durationMs: 0 })).toBe(false);
  });
});
