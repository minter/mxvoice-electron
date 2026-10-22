import { beforeEach, describe, expect, it, vi } from 'vitest';

const getPreference = vi.fn();
vi.mock('../../../src/renderer/modules/preferences/profile-preference-adapter.js', () => ({ getPreference }));

const elements = new Map();
function element() {
  const classes = new Set();
  return { classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) }, style: {}, textContent: '', getAttribute: vi.fn(() => null), setAttribute: vi.fn(), removeAttribute: vi.fn() };
}
globalThis.window = { debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, secureElectronAPI: {} };
globalThis.document = {
  getElementById: id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
  querySelector: vi.fn(() => null),
  querySelectorAll: vi.fn(() => [])
};
globalThis.cancelAnimationFrame = vi.fn();

const sharedState = (await import('../../../src/renderer/modules/shared-state.js')).default;
const audio = await import('../../../src/renderer/modules/audio/audio-controller.js');

function fakeSound() {
  const listeners = {};
  return {
    listeners,
    volume: vi.fn(() => 1),
    fade: vi.fn(),
    on: vi.fn((name, fn) => { listeners[name] = fn; }),
    off: vi.fn(),
    unload: vi.fn(),
    playing: vi.fn(() => true),
    pause: vi.fn()
  };
}

describe('stop during a fade', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
    sharedState.reset();
    getPreference.mockResolvedValue({ success: true, value: '3' });
  });

  it('reports a fade for the current sound until it ends', async () => {
    const sound = fakeSound();
    sharedState.set('sound', sound);
    expect(audio.isFadingOut()).toBe(false);

    audio.stopPlaying(true);
    expect(audio.isFadingOut()).toBe(true);
    await vi.waitFor(() => expect(sound.fade).toHaveBeenCalledWith(1, 0, 3000));

    sound.listeners.fade();
    expect(sharedState.get('sound')).toBe(null);
    expect(audio.isFadingOut()).toBe(false);
  });

  it('cuts instead of restarting the fade on a second fade stop', async () => {
    const sound = fakeSound();
    sharedState.set('sound', sound);
    audio.stopPlaying(true);
    await vi.waitFor(() => expect(sound.fade).toHaveBeenCalledTimes(1));

    audio.stopPlaying(true);

    expect(sound.unload).toHaveBeenCalledTimes(1);
    expect(sound.fade).toHaveBeenCalledTimes(1);
    expect(sharedState.get('sound')).toBe(null);
    expect(audio.isFadingOut()).toBe(false);
  });

  it('does not fade a sound cut while the fade length was being read', async () => {
    const sound = fakeSound();
    sharedState.set('sound', sound);
    let resolveRead;
    getPreference.mockReturnValue(new Promise(resolve => { resolveRead = resolve; }));

    audio.stopPlaying(true);
    audio.stopPlaying(false);
    expect(sound.unload).toHaveBeenCalledTimes(1);

    resolveRead({ success: true, value: '3' });
    await Promise.resolve();
    await Promise.resolve();
    expect(sound.fade).not.toHaveBeenCalled();
    expect(sound.unload).toHaveBeenCalledTimes(1);
  });

  it('a fade on a new song is not mistaken for the old fade', async () => {
    const first = fakeSound();
    sharedState.set('sound', first);
    audio.stopPlaying(true);

    const second = fakeSound();
    sharedState.set('sound', second);
    expect(audio.isFadingOut()).toBe(false);

    audio.stopPlaying(true);
    await vi.waitFor(() => expect(second.fade).toHaveBeenCalledTimes(1));
    expect(second.unload).not.toHaveBeenCalled();
  });
});

describe('fade length', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
    sharedState.reset();
  });

  async function stopFadeDuration(preference) {
    if (preference instanceof Error) getPreference.mockRejectedValue(preference);
    else getPreference.mockResolvedValue(preference);
    const sound = fakeSound();
    sharedState.set('sound', sound);
    audio.stopPlaying(true);
    await vi.waitFor(() => expect(sound.fade).toHaveBeenCalled());
    return sound.fade.mock.calls[0][2];
  }

  it('reads the fade length from the profile', async () => {
    expect(await stopFadeDuration({ success: true, value: 8 })).toBe(8000);
    expect(getPreference).toHaveBeenCalledWith('fade_out_seconds', window.secureElectronAPI);
    expect(await stopFadeDuration({ success: true, value: '1.5' })).toBe(1500);
  });

  it('falls back to the default when the profile has no usable value', async () => {
    expect(audio.DEFAULT_FADE_OUT_SECONDS).toBe(3);
    for (const preference of [
      { success: true, value: null },
      { success: true, value: 0 },
      { success: true, value: 'soon' },
      { success: false, error: 'no profile' },
      new Error('IPC down')
    ]) {
      expect(await stopFadeDuration(preference)).toBe(3000);
    }
  });

  it('fade-pause uses the same fade length', async () => {
    getPreference.mockResolvedValue({ success: true, value: 4 });
    const sound = fakeSound();
    sharedState.set('sound', sound);

    audio.pausePlaying(true);

    await vi.waitFor(() => expect(sound.fade).toHaveBeenCalledWith(1, 0, 4000));
    sound.listeners.fade();
    expect(sound.pause).toHaveBeenCalled();
    expect(sound.volume).toHaveBeenLastCalledWith(1);
  });
});
