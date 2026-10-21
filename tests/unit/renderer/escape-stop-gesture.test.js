import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { EscapeStopGesture, HOLD_TO_FADE_MS } = await import('../../../src/renderer/modules/keyboard-manager/escape-stop-gesture.js');

describe('Esc stop gesture', () => {
  let stop;
  let fading;
  let gesture;

  beforeEach(() => {
    vi.useFakeTimers();
    stop = vi.fn();
    fading = false;
    gesture = new EscapeStopGesture({ stop, isFadingOut: () => fading });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cuts on a tap, when the key comes back up', () => {
    gesture.keyDown({});
    expect(stop).not.toHaveBeenCalled();

    vi.advanceTimersByTime(80);
    gesture.keyUp();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith(false);

    // The hold timer was cancelled, so no fade follows the cut
    vi.advanceTimersByTime(HOLD_TO_FADE_MS * 2);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('fades once the key has been held, and does nothing more on release', () => {
    gesture.keyDown({});
    vi.advanceTimersByTime(HOLD_TO_FADE_MS - 1);
    expect(stop).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(stop).toHaveBeenCalledWith(true);

    gesture.keyUp();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('ignores key repeat while the key is held', () => {
    gesture.keyDown({});
    vi.advanceTimersByTime(200);
    gesture.keyDown({ repeat: true });
    vi.advanceTimersByTime(HOLD_TO_FADE_MS - 200);

    // The first keydown's timer still decides: fade at the original time
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith(true);
  });

  it('cuts at once on keydown while a fade is running', () => {
    fading = true;
    gesture.keyDown({});

    expect(stop).toHaveBeenCalledWith(false);

    // Neither the release nor the timer adds another stop
    gesture.keyUp();
    vi.advanceTimersByTime(HOLD_TO_FADE_MS * 2);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('still fades when the keyup never arrives', () => {
    gesture.keyDown({});
    vi.advanceTimersByTime(HOLD_TO_FADE_MS);
    expect(stop).toHaveBeenCalledWith(true);
  });

  it('ignores a keyup without a keydown it saw', () => {
    gesture.keyUp();
    expect(stop).not.toHaveBeenCalled();
  });

  it('cancelHold drops a pending fade', () => {
    gesture.keyDown({});
    gesture.cancelHold();
    vi.advanceTimersByTime(HOLD_TO_FADE_MS * 2);
    gesture.keyUp();
    expect(stop).not.toHaveBeenCalled();
  });
});

describe('Esc stop gesture wiring', () => {
  it('binds Esc keydown through the registry and Esc keyup directly', async () => {
    const bind = vi.fn();
    const unbind = vi.fn();
    globalThis.Mousetrap = Object.assign(vi.fn(() => ({ bind, unbind })), { bind, unbind });
    const { NavigationShortcuts } = await import('../../../src/renderer/modules/keyboard-manager/navigation-shortcuts.js');

    const stopPlaying = vi.fn();
    const isFadingOut = vi.fn(() => false);
    const nav = new NavigationShortcuts({
      debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      moduleRegistry: { audio: { stopPlaying, isFadingOut } }
    });
    nav.setupAudioControls();

    const keyup = bind.mock.calls.find(([combo, , action]) => combo === 'esc' && action === 'keyup');
    expect(keyup).toBeDefined();

    // Tap: registry keydown, then the direct keyup binding
    nav.getBindings().get('esc').handler({});
    expect(keyup[1]()).toBe(false);
    expect(stopPlaying).toHaveBeenCalledWith(false);

    // During a fade, keydown alone cuts
    isFadingOut.mockReturnValue(true);
    nav.getBindings().get('esc').handler({});
    expect(stopPlaying).toHaveBeenCalledTimes(2);

    nav.cleanup();
    expect(unbind).toHaveBeenCalledWith('esc', 'keyup');
  });

  it('runs the same gesture in search fields, keeping Shift+Esc as a fade', async () => {
    vi.useFakeTimers();
    try {
      globalThis.window = { debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } };
      const inputs = [];
      const input = () => {
        const handlers = {};
        const el = { handlers, name: `in${inputs.length}`, addEventListener: (n, h) => { handlers[n] = h; }, removeEventListener: vi.fn() };
        inputs.push(el);
        return el;
      };
      const form = { addEventListener: vi.fn(), removeEventListener: vi.fn(), querySelectorAll: () => [input()] };
      globalThis.document = { getElementById: (id) => (id === 'search_form' ? form : null), querySelector: () => null, querySelectorAll: () => [] };
      const SearchEvents = (await import('../../../src/renderer/modules/event-coordination/search-events.js')).default;

      const stopPlaying = vi.fn();
      const events = new SearchEvents({ debugLog: window.debugLog, moduleRegistry: { audio: { stopPlaying, isFadingOut: () => false } } });
      events.attachSearchFormEvents();
      const { keydown, keyup } = inputs[0].handlers;
      const esc = (extra = {}) => ({ key: 'Escape', code: 'Escape', preventDefault: vi.fn(), stopPropagation: vi.fn(), ...extra });

      keydown(esc());
      keyup(esc());
      expect(stopPlaying).toHaveBeenLastCalledWith(false);

      keydown(esc());
      vi.advanceTimersByTime(HOLD_TO_FADE_MS);
      expect(stopPlaying).toHaveBeenLastCalledWith(true);
      keyup(esc());
      expect(stopPlaying).toHaveBeenCalledTimes(2);

      keydown(esc({ shiftKey: true }));
      keyup(esc({ shiftKey: true }));
      expect(stopPlaying).toHaveBeenLastCalledWith(true);
      expect(stopPlaying).toHaveBeenCalledTimes(3);

      // Without an audio module the stop only logs
      events.moduleRegistry = {};
      events.stopPlaying(false);
      expect(window.debugLog.warn).toHaveBeenCalledWith('stopPlaying function not available');
    } finally {
      vi.useRealTimers();
    }
  });
});
