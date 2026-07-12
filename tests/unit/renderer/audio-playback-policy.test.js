import { describe, expect, it } from 'vitest';
import {
  calculatePlaybackVolume,
  determinePlaybackCompletionAction,
  getCrossfadePolicy,
  getTrackBounds
} from '../../../src/renderer/modules/audio/playback-policy.js';

describe('audio playback policy', () => {
  it('combines master and track volume percentages', () => {
    expect(calculatePlaybackVolume('80', 50)).toEqual({
      masterVolume: 0.8,
      trackVolume: 0.5,
      targetVolume: 0.4
    });
  });

  it('uses the established three-second crossfade default', () => {
    expect(getCrossfadePolicy({ crossfade: true })).toEqual({
      enabled: true,
      seconds: 3,
      durationMs: 3000
    });
    expect(getCrossfadePolicy({ crossfade: false, crossfadeSeconds: 5 }).durationMs).toBe(0);
  });

  it('preserves zero-valued trim bounds', () => {
    expect(getTrackBounds({ start_time: 0, end_time: 0 })).toEqual({ startTime: 0, endTime: 0 });
    expect(getTrackBounds({})).toEqual({ startTime: null, endTime: null });
  });

  it('prioritizes loop over playlist autoplay', () => {
    expect(determinePlaybackCompletionAction({ loop: true, autoplay: true, holdingTankMode: 'playlist' })).toBe('loop');
    expect(determinePlaybackCompletionAction({ loop: false, autoplay: true, holdingTankMode: 'playlist' })).toBe('autoplay');
    expect(determinePlaybackCompletionAction({ loop: false, autoplay: true, holdingTankMode: 'storage' })).toBe('stop');
  });
});
