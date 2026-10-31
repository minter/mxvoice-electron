import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { EscapeStopGesture, HOLD_TO_FADE_MS } = await import('../../../src/renderer/modules/keyboard-manager/escape-stop-gesture.js');
const sharedState = (await import('../../../src/renderer/modules/shared-state.js')).default;

describe('Esc stop gesture', () => {
  let stop;
  let fading;
  let sound;
  let clock;
  let gesture;

  beforeEach(() => {
    vi.useFakeTimers();
    stop = vi.fn();
    fading = false;
    sound = { name: 'song A' };
    clock = 0;
    gesture = new EscapeStopGesture({
      stop,
      isFadingOut: () => fading,
      currentSound: () => sound,
      now: () => clock
    });
  });

  // Moves the fake timers and the gesture's clock together
  const advance = (ms) => {
    clock += ms;
    vi.advanceTimersByTime(ms);
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cuts on a tap, when the key comes back up', () => {
    gesture.keyDown({});
    expect(stop).not.toHaveBeenCalled();

    advance(80);
    gesture.keyUp();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith(false);

    // The hold timer was cancelled, so no fade follows the cut
    advance(HOLD_TO_FADE_MS * 2);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('fades once the key has been held, and does nothing more on release', () => {
    gesture.keyDown({});
    advance(HOLD_TO_FADE_MS - 1);
    expect(stop).not.toHaveBeenCalled();

    advance(1);
    expect(stop).toHaveBeenCalledWith(true);

    gesture.keyUp();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('ignores key repeat while the key is held', () => {
    gesture.keyDown({});
    advance(200);
    gesture.keyDown({ repeat: true });
    advance(HOLD_TO_FADE_MS - 200);

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
    advance(HOLD_TO_FADE_MS * 2);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('still fades when the keyup never arrives', () => {
    gesture.keyDown({});
    advance(HOLD_TO_FADE_MS);
    expect(stop).toHaveBeenCalledWith(true);
  });

  it('ignores a keyup without a keydown it saw', () => {
    gesture.keyUp();
    expect(stop).not.toHaveBeenCalled();
  });

  it('cancelHold drops a pending fade', () => {
    gesture.keyDown({});
    gesture.cancelHold();
    advance(HOLD_TO_FADE_MS * 2);
    gesture.keyUp();
    expect(stop).not.toHaveBeenCalled();
  });

  it('Esc down, a new song starts, Esc up: nothing is stopped', () => {
    gesture.keyDown({});
    sound = { name: 'song B' };
    advance(80);
    gesture.keyUp();

    advance(HOLD_TO_FADE_MS * 2);
    expect(stop).not.toHaveBeenCalled();
  });

  it('Esc down, a new song starts, the hold timer fires: nothing is stopped', () => {
    gesture.keyDown({});
    advance(100);
    sound = { name: 'song B' };
    advance(HOLD_TO_FADE_MS);
    expect(stop).not.toHaveBeenCalled();

    // The release after that is no stop either
    gesture.keyUp();
    expect(stop).not.toHaveBeenCalled();
  });

  it('Esc held 400 ms with the timer delayed past keyup: fades', () => {
    // A stalled renderer: the hold timer is queued but never gets to run
    const timers = [];
    gesture = new EscapeStopGesture({
      stop,
      currentSound: () => sound,
      now: () => clock,
      setTimer: (fn) => timers.push(fn),
      clearTimer: vi.fn()
    });

    gesture.keyDown({});
    clock += 400;
    gesture.keyUp();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith(true);
  });

  it('a tap under 300 ms cuts the song that was playing', () => {
    gesture.keyDown({});
    advance(HOLD_TO_FADE_MS - 1);
    gesture.keyUp();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith(false);
  });

  it('does nothing when Esc goes down with no song playing', () => {
    sound = null;
    gesture.keyDown({});
    sound = { name: 'song B' };
    advance(80);
    gesture.keyUp();
    gesture.keyDown({});
    advance(HOLD_TO_FADE_MS);

    // Only the second press, made while song B played, stops anything
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith(true);
  });
});

describe('Esc stop gesture wiring', () => {
  // The gestures read the playing song from shared state
  beforeEach(() => {
    sharedState.set('sound', { name: 'playing song' });
  });

  afterEach(() => {
    sharedState.set('sound', null);
  });

  const quietLog = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() });

  it('Shift+Esc key repeat during a fade does not cut', async () => {
    const bind = vi.fn();
    globalThis.Mousetrap = Object.assign(vi.fn(() => ({ bind, unbind: vi.fn() })), { bind, unbind: vi.fn() });
    const { NavigationShortcuts } = await import('../../../src/renderer/modules/keyboard-manager/navigation-shortcuts.js');

    // Global binding: the first keydown fades, held-key repeats change nothing
    const navStop = vi.fn();
    const nav = new NavigationShortcuts({
      debugLog: quietLog(),
      moduleRegistry: { audio: { stopPlaying: navStop, isFadingOut: () => navStop.mock.calls.length > 0 } }
    });
    nav.setupAudioControls();
    const shiftEsc = nav.getBindings().get('shift+esc').handler;
    shiftEsc({});
    shiftEsc({ repeat: true });
    shiftEsc({ repeat: true });
    expect(navStop).toHaveBeenCalledTimes(1);
    expect(navStop).toHaveBeenCalledWith(true);

    // Search field: the same
    globalThis.window = { debugLog: quietLog() };
    const handlers = {};
    const field = { name: 'omni_search', addEventListener: (n, h) => { handlers[n] = h; }, removeEventListener: vi.fn() };
    const form = { addEventListener: vi.fn(), removeEventListener: vi.fn(), querySelectorAll: () => [field] };
    globalThis.document = { getElementById: (id) => (id === 'search_form' ? form : null), querySelector: () => null, querySelectorAll: () => [] };
    const SearchEvents = (await import('../../../src/renderer/modules/event-coordination/search-events.js')).default;

    const searchStop = vi.fn();
    const events = new SearchEvents({
      debugLog: window.debugLog,
      moduleRegistry: { audio: { stopPlaying: searchStop, isFadingOut: () => searchStop.mock.calls.length > 0 } }
    });
    events.attachSearchFormEvents();
    const shiftEscKey = (extra = {}) => ({ key: 'Escape', code: 'Escape', shiftKey: true, preventDefault: vi.fn(), stopPropagation: vi.fn(), ...extra });
    handlers.keydown(shiftEscKey());
    const repeat = shiftEscKey({ repeat: true });
    handlers.keydown(repeat);
    handlers.keydown(shiftEscKey({ repeat: true }));
    expect(searchStop).toHaveBeenCalledTimes(1);
    expect(searchStop).toHaveBeenCalledWith(true);
    // A repeat is still kept away from the field and the page
    expect(repeat.preventDefault).toHaveBeenCalled();
  });

  it('binds Esc keydown through the registry and Esc keyup directly', async () => {
    const bind = vi.fn();
    const unbind = vi.fn();
    globalThis.Mousetrap = Object.assign(vi.fn(() => ({ bind, unbind })), { bind, unbind });
    const { NavigationShortcuts } = await import('../../../src/renderer/modules/keyboard-manager/navigation-shortcuts.js');

    const stopPlaying = vi.fn();
    const isFadingOut = vi.fn(() => false);
    const nav = new NavigationShortcuts({
      debugLog: quietLog(),
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
