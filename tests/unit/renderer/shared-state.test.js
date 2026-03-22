import { describe, it, expect, beforeEach, vi } from 'vitest';

// SharedState uses `window.debugLog`, so we need a minimal global stub.
// Vitest runs in Node where `window` doesn't exist — provide one.
const mockDebugLog = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
globalThis.window = globalThis.window || {};
window.debugLog = mockDebugLog;

// Now import the module (uses `window.debugLog` internally)
const { default: sharedState, getState, setState, subscribe, getAllState, resetState } = await import(
  '../../../src/renderer/modules/shared-state.js'
);

describe('SharedState', () => {
  beforeEach(() => {
    sharedState.reset();
    sharedState.listeners.clear();
    vi.clearAllMocks();
  });

  // ── Constructor / defaults ──────────────────────────────────────────

  describe('defaults', () => {
    it('has expected default values', () => {
      expect(sharedState.get('sound')).toBe(null);
      expect(sharedState.get('autoplay')).toBe(false);
      expect(sharedState.get('loop')).toBe(false);
      expect(sharedState.get('holdingTankMode')).toBe('storage');
      expect(sharedState.get('fontSize')).toBe(11);
      expect(sharedState.get('categories')).toEqual({});
      expect(sharedState.get('db')).toBe(null);
    });
  });

  // ── get / set ───────────────────────────────────────────────────────

  describe('get and set', () => {
    it('sets and retrieves a value', () => {
      sharedState.set('autoplay', true);
      expect(sharedState.get('autoplay')).toBe(true);
    });

    it('sets object values', () => {
      const cats = { GAME: 'Game', GROAN: 'Groaner' };
      sharedState.set('categories', cats);
      expect(sharedState.get('categories')).toEqual(cats);
    });

    it('overwrites previous value', () => {
      sharedState.set('fontSize', 14);
      sharedState.set('fontSize', 18);
      expect(sharedState.get('fontSize')).toBe(18);
    });
  });

  // ── Key validation ──────────────────────────────────────────────────

  describe('key validation', () => {
    it('warns on get() with unknown key', () => {
      sharedState.get('bogusKey');
      expect(mockDebugLog.warn).toHaveBeenCalledWith(
        expect.stringContaining('unknown key'),
        expect.objectContaining({ function: 'get' }),
      );
    });

    it('warns on set() with unknown key', () => {
      sharedState.set('bogusKey', 123);
      expect(mockDebugLog.warn).toHaveBeenCalledWith(
        expect.stringContaining('unknown key'),
        expect.objectContaining({ function: 'set' }),
      );
    });

    it('warns on subscribe() with unknown key', () => {
      sharedState.subscribe('bogusKey', () => {});
      expect(mockDebugLog.warn).toHaveBeenCalledWith(
        expect.stringContaining('unknown key'),
        expect.objectContaining({ function: 'subscribe' }),
      );
    });

    it('does not warn on valid keys', () => {
      sharedState.get('autoplay');
      sharedState.set('loop', true);
      sharedState.subscribe('sound', () => {});
      expect(mockDebugLog.warn).not.toHaveBeenCalled();
    });
  });

  // ── subscribe / unsubscribe ─────────────────────────────────────────

  describe('subscribe', () => {
    it('calls listener when value changes', () => {
      const cb = vi.fn();
      sharedState.subscribe('autoplay', cb);
      sharedState.set('autoplay', true);
      expect(cb).toHaveBeenCalledWith(true);
    });

    it('supports multiple listeners on the same key', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      sharedState.subscribe('fontSize', cb1);
      sharedState.subscribe('fontSize', cb2);
      sharedState.set('fontSize', 20);
      expect(cb1).toHaveBeenCalledWith(20);
      expect(cb2).toHaveBeenCalledWith(20);
    });

    it('does not fire listeners for other keys', () => {
      const cb = vi.fn();
      sharedState.subscribe('autoplay', cb);
      sharedState.set('loop', true);
      expect(cb).not.toHaveBeenCalled();
    });

    it('returns an unsubscribe function that stops notifications', () => {
      const cb = vi.fn();
      const unsub = sharedState.subscribe('autoplay', cb);
      unsub();
      sharedState.set('autoplay', true);
      expect(cb).not.toHaveBeenCalled();
    });

    it('unsubscribing one listener does not affect others', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const unsub1 = sharedState.subscribe('fontSize', cb1);
      sharedState.subscribe('fontSize', cb2);
      unsub1();
      sharedState.set('fontSize', 16);
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledWith(16);
    });
  });

  // ── Error handling in listeners ─────────────────────────────────────

  describe('listener error handling', () => {
    it('catches errors from listeners and continues notifying others', () => {
      const badCb = vi.fn(() => { throw new Error('boom'); });
      const goodCb = vi.fn();
      sharedState.subscribe('autoplay', badCb);
      sharedState.subscribe('autoplay', goodCb);

      // Should not throw
      sharedState.set('autoplay', true);

      expect(badCb).toHaveBeenCalled();
      expect(goodCb).toHaveBeenCalledWith(true);
      expect(mockDebugLog.error).toHaveBeenCalledWith(
        expect.stringContaining('autoplay'),
        expect.any(Error),
        expect.objectContaining({ function: 'notifyListeners' }),
      );
    });
  });

  // ── getAll ──────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('returns a shallow copy of all state', () => {
      sharedState.set('autoplay', true);
      const all = sharedState.getAll();
      expect(all.autoplay).toBe(true);
      // Verify it's a copy, not the internal object
      all.autoplay = false;
      expect(sharedState.get('autoplay')).toBe(true);
    });
  });

  // ── reset ───────────────────────────────────────────────────────────

  describe('reset', () => {
    it('restores all values to defaults', () => {
      sharedState.set('autoplay', true);
      sharedState.set('fontSize', 24);
      sharedState.set('holdingTankMode', 'playlist');
      sharedState.reset();

      expect(sharedState.get('autoplay')).toBe(false);
      expect(sharedState.get('fontSize')).toBe(11);
      expect(sharedState.get('holdingTankMode')).toBe('storage');
    });
  });

  // ── Convenience exports ─────────────────────────────────────────────

  describe('module-level convenience exports', () => {
    it('getState reads from the singleton', () => {
      sharedState.set('loop', true);
      expect(getState('loop')).toBe(true);
    });

    it('setState writes to the singleton', () => {
      setState('loop', true);
      expect(sharedState.get('loop')).toBe(true);
    });

    it('subscribe attaches to the singleton', () => {
      const cb = vi.fn();
      const unsub = subscribe('autoplay', cb);
      setState('autoplay', true);
      expect(cb).toHaveBeenCalledWith(true);
      unsub();
    });

    it('getAllState returns full state', () => {
      const all = getAllState();
      expect(all).toHaveProperty('autoplay');
      expect(all).toHaveProperty('fontSize');
    });

    it('resetState resets the singleton', () => {
      setState('autoplay', true);
      resetState();
      expect(getState('autoplay')).toBe(false);
    });
  });
});
