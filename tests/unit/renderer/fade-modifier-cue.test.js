import { beforeEach, describe, expect, it, vi } from 'vitest';

// Shift over Stop or Pause shows the fade the click will do; only the hovered
// button changes, so Shift while typing elsewhere does nothing.

function makeButton(id) {
  const listeners = {};
  const classes = new Set();
  const attrs = {};
  return {
    id,
    disabled: false,
    dataset: {},
    listeners,
    attrs,
    classList: {
      toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
      contains: (name) => classes.has(name)
    },
    setAttribute: (name, value) => { attrs[name] = value; },
    addEventListener: (name, handler) => { listeners[name] = handler; },
    fire(name, event = {}) { listeners[name]?.({ shiftKey: false, ...event }); }
  };
}

const stop = makeButton('stop_button');
const pause = makeButton('pause_button');
const winListeners = {};
const tooltips = new Map();
globalThis.document = { getElementById: (id) => ({ stop_button: stop, pause_button: pause })[id] || null };
globalThis.window = {
  addEventListener: (name, handler) => { winListeners[name] = handler; },
  bootstrap: { Tooltip: { getInstance: (el) => tooltips.get(el) || null } }
};

const cue = await import('../../../src/renderer/modules/ui/fade-modifier-cue.js');
cue.initFadeModifierCue(document, window);

const key = (type, k = 'Shift') => winListeners[type]({ key: k });

describe('Shift fade cue', () => {
  beforeEach(() => {
    key('keyup');
    stop.fire('mouseleave');
    pause.fire('mouseleave');
    stop.disabled = false;
    tooltips.clear();
  });

  it('starts with the normal tooltips that mention Shift-click', () => {
    expect(stop.attrs['aria-label']).toBe('Stop (Shift-click to fade out)');
    expect(pause.attrs['aria-label']).toBe('Pause (Shift-click to fade out, then pause)');
    expect(stop.classList.contains('fade-cue')).toBe(false);
  });

  it('shows the fade only on the hovered button while Shift is down', () => {
    stop.fire('mouseenter');
    key('keydown');
    expect(stop.classList.contains('fade-cue')).toBe(true);
    expect(stop.attrs['aria-label']).toBe('Fade out');
    expect(pause.classList.contains('fade-cue')).toBe(false);

    key('keyup');
    expect(stop.classList.contains('fade-cue')).toBe(false);
    expect(stop.attrs['aria-label']).toBe('Stop (Shift-click to fade out)');
  });

  it('ignores Shift when no button is hovered, like typing in search', () => {
    key('keydown');
    expect(stop.classList.contains('fade-cue')).toBe(false);
    expect(pause.classList.contains('fade-cue')).toBe(false);
  });

  it('picks up Shift already held when the pointer arrives, and clears on leaving', () => {
    pause.fire('mouseenter', { shiftKey: true });
    expect(pause.classList.contains('fade-cue')).toBe(true);
    expect(pause.attrs['aria-label']).toBe('Fade out, then pause');
    pause.fire('mouseleave');
    expect(pause.classList.contains('fade-cue')).toBe(false);
  });

  it('clears when the window loses focus mid-hold', () => {
    stop.fire('mouseenter');
    key('keydown');
    winListeners.blur();
    expect(stop.classList.contains('fade-cue')).toBe(false);
  });

  it('shows no cue on a disabled button', () => {
    stop.disabled = true;
    stop.fire('mouseenter', { shiftKey: true });
    expect(stop.classList.contains('fade-cue')).toBe(false);
  });

  it('updates a live Bootstrap tooltip in place instead of the title attribute', () => {
    const setContent = vi.fn();
    tooltips.set(stop, { setContent });
    stop.fire('mouseenter', { shiftKey: true });
    expect(setContent).toHaveBeenCalledWith({ '.tooltip-inner': 'Fade out' });
  });

  it('sets up its listeners only once', () => {
    const before = Object.keys(winListeners).length;
    cue.initFadeModifierCue(document, window);
    expect(Object.keys(winListeners).length).toBe(before);
  });
});
