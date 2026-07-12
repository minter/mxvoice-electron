import { describe, expect, it, vi } from 'vitest';
import {
  parseCrossfadePreference,
  prepareForPlaybackReplacement
} from '../../../src/renderer/modules/audio/playback-replacement.js';

function createState(entries) {
  const values = new Map(Object.entries(entries));
  return { get: (key) => values.get(key), set: (key, value) => values.set(key, value) };
}

describe('playback replacement', () => {
  it('releases active and outgoing sounds for a normal replacement', () => {
    const active = { off: vi.fn(), unload: vi.fn() };
    const outgoing = { off: vi.fn(), unload: vi.fn() };
    const sharedState = createState({ sound: active, outgoingSound: outgoing });
    expect(prepareForPlaybackReplacement({ sharedState, crossfade: false })).toBe(true);
    expect(active.off).toHaveBeenCalledWith('fade');
    expect(active.unload).toHaveBeenCalledOnce();
    expect(outgoing.unload).toHaveBeenCalledOnce();
    expect(sharedState.get('sound')).toBeNull();
    expect(sharedState.get('outgoingSound')).toBeNull();
  });

  it('preserves sounds during a crossfade replacement', () => {
    const active = { off: vi.fn(), unload: vi.fn() };
    const sharedState = createState({ sound: active });
    expect(prepareForPlaybackReplacement({ sharedState, crossfade: true })).toBe(false);
    expect(active.unload).not.toHaveBeenCalled();
  });

  it('normalizes crossfade preference values', () => {
    expect(parseCrossfadePreference({ success: true, value: '2.5' })).toBe(2.5);
    expect(parseCrossfadePreference({ success: true, value: 'invalid' })).toBe(0);
    expect(parseCrossfadePreference({ success: false, value: '3' })).toBe(0);
  });
});
