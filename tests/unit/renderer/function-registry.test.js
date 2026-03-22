import { describe, it, expect, beforeEach, vi } from 'vitest';

// Provide a minimal window global for the registry (assigns functions to window)
globalThis.window = globalThis.window || {};

const { default: FunctionRegistry } = await import(
  '../../../src/renderer/function-registry.js'
);

const mockDebugLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('FunctionRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new FunctionRegistry();
    registry.setDebugLogger(mockDebugLog);

    // Clear any window properties we may set during tests
    delete window.testFn;
    delete window.anotherFn;
    delete window.myFunc;
    delete window.fallbackFn;
    vi.clearAllMocks();
  });

  // ── Constructor ─────────────────────────────────────────────────────

  describe('constructor', () => {
    it('starts with empty collections', () => {
      const r = new FunctionRegistry();
      expect(r.registry.size).toBe(0);
      expect(r.fallbacks.size).toBe(0);
      expect(r.registeredFunctions.size).toBe(0);
      expect(r.moduleRegistry).toBe(null);
    });

    it('accepts an optional debug logger', () => {
      const r = new FunctionRegistry(mockDebugLog);
      expect(r.debugLog).toBe(mockDebugLog);
    });
  });

  // ── setDebugLogger ──────────────────────────────────────────────────

  describe('setDebugLogger', () => {
    it('sets the logger', () => {
      const r = new FunctionRegistry();
      r.setDebugLogger(mockDebugLog);
      expect(r.debugLog).toBe(mockDebugLog);
    });

    it('throws if null is passed', () => {
      const r = new FunctionRegistry();
      expect(() => r.setDebugLogger(null)).toThrow(/requires a valid debug logger/);
    });
  });

  // ── ensureDebugLogger ───────────────────────────────────────────────

  describe('ensureDebugLogger', () => {
    it('throws when no logger is set', () => {
      const r = new FunctionRegistry();
      expect(() => r.ensureDebugLogger()).toThrow(/DebugLogger not initialized/);
    });

    it('does not throw when logger exists', () => {
      expect(() => registry.ensureDebugLogger()).not.toThrow();
    });
  });

  // ── register ────────────────────────────────────────────────────────

  describe('register', () => {
    it('registers a function and assigns it to window', () => {
      const fn = () => 'hello';
      registry.register('testFn', fn);

      expect(registry.registry.get('testFn')).toBe(fn);
      expect(registry.registeredFunctions.has('testFn')).toBe(true);
      expect(window.testFn).toBe(fn);
    });

    it('logs info on successful registration', () => {
      registry.register('testFn', () => {});
      expect(mockDebugLog.info).toHaveBeenCalledWith(
        expect.stringContaining('testFn'),
        expect.any(Object),
      );
    });

    it('stores fallback when provided', () => {
      const fn = () => 'main';
      const fb = () => 'fallback';
      registry.register('testFn', fn, fb);

      expect(registry.fallbacks.get('testFn')).toBe(fb);
    });

    it('does not overwrite existing window property', () => {
      const original = () => 'original';
      window.testFn = original;

      registry.register('testFn', () => 'new');

      expect(window.testFn).toBe(original);
      expect(mockDebugLog.warn).toHaveBeenCalledWith(
        expect.stringContaining('already exists'),
        expect.any(Object),
      );
    });

    it('still tracks in registry even when window slot is taken', () => {
      window.testFn = () => 'existing';
      const newFn = () => 'new';
      registry.register('testFn', newFn);

      expect(registry.registry.get('testFn')).toBe(newFn);
      expect(registry.registeredFunctions.has('testFn')).toBe(true);
    });

    it('throws if debug logger is not set', () => {
      const r = new FunctionRegistry();
      expect(() => r.register('x', () => {})).toThrow(/DebugLogger/);
    });
  });

  // ── registerModule ──────────────────────────────────────────────────

  describe('registerModule', () => {
    it('resolves functions from moduleRegistry by string path', () => {
      const myFn = () => 'resolved';
      registry.setModuleRegistry({ myMod: { myFunc: myFn } });
      registry.registerModule('myMod', { myFunc: 'myFunc' });

      // getFunctionFromPath binds the function, so check by calling
      expect(typeof window.myFunc).toBe('function');
      expect(window.myFunc()).toBe('resolved');
    });

    it('registers direct function values', () => {
      const fn = () => 'direct';
      registry.setModuleRegistry({ myMod: {} });
      registry.registerModule('myMod', { testFn: fn });

      expect(window.testFn).toBe(fn);
    });

    it('uses Fallback entries as fallbacks, not standalone registrations', () => {
      registry.setModuleRegistry({ myMod: {} });
      const main = () => 'main';
      const fb = () => 'fb';
      registry.registerModule('myMod', {
        testFn: main,
        testFnFallback: fb,
      });

      // The main function should be registered
      expect(registry.isRegistered('testFn')).toBe(true);
      // The fallback is stored in the fallbacks map, not as a separate named registration
      expect(registry.fallbacks.get('testFn')).toBe(fb);
    });

    it('falls back to function values when module is not in registry', () => {
      registry.setModuleRegistry(null);
      const fb = () => 'fallback';
      registry.registerModule('missing', { testFn: fb });

      expect(window.testFn).toBe(fb);
      expect(mockDebugLog.warn).toHaveBeenCalledWith(
        expect.stringContaining('not available'),
        expect.any(Object),
      );
    });

    it('warns when function path not found in module', () => {
      registry.setModuleRegistry({ myMod: {} });
      registry.registerModule('myMod', { testFn: 'nonExistent' });

      expect(mockDebugLog.warn).toHaveBeenCalledWith(
        expect.stringContaining('not found'),
        expect.any(Object),
      );
    });

    it('uses fallback when function path not found', () => {
      const fb = () => 'fallback';
      registry.setModuleRegistry({ myMod: {} });
      registry.registerModule('myMod', {
        testFn: 'nonExistent',
        testFnFallback: fb,
      });

      expect(window.testFn).toBe(fb);
    });
  });

  // ── getFunctionFromPath ─────────────────────────────────────────────

  describe('getFunctionFromPath', () => {
    it('resolves a simple property name', () => {
      const fn = () => 'found';
      const obj = { myFunc: fn };
      const result = registry.getFunctionFromPath(obj, 'myFunc');
      // It binds the function, so check by calling it
      expect(result()).toBe('found');
    });

    it('resolves dot-notation paths', () => {
      const fn = () => 'nested';
      const obj = { audio: { play: fn } };
      const result = registry.getFunctionFromPath(obj, 'audio.play');
      expect(result()).toBe('nested');
    });

    it('returns undefined for missing paths', () => {
      const obj = { audio: {} };
      const result = registry.getFunctionFromPath(obj, 'audio.missing');
      expect(result).toBeUndefined();
    });

    it('returns null/undefined for null objects', () => {
      const result = registry.getFunctionFromPath(null, 'anything');
      expect(result).toBeFalsy();
    });
  });

  // ── registerModuleInline ────────────────────────────────────────────

  describe('registerModuleInline', () => {
    it('registers from inline mappings for known module names', () => {
      registry.setModuleRegistry({
        audio: {
          playSongFromId: () => 'play',
          stopPlaying: () => 'stop',
          pausePlaying: () => 'pause',
          resetUIState: () => {},
          autoplay_next: () => {},
          cancel_autoplay: () => {},
          playSelected: () => {},
          loop_on: () => {},
        },
      });

      registry.registerModuleInline('audio');
      expect(registry.isRegistered('playSongFromId')).toBe(true);
      expect(registry.isRegistered('stopPlaying')).toBe(true);
    });

    it('warns for unknown module names', () => {
      registry.registerModuleInline('unknownModule');
      expect(mockDebugLog.warn).toHaveBeenCalledWith(
        expect.stringContaining('No inline mapping'),
        expect.any(Object),
      );
    });
  });

  // ── validateFunctions ───────────────────────────────────────────────

  describe('validateFunctions', () => {
    it('returns false when required functions are missing', () => {
      // Ensure none of the required functions are on window
      const required = [
        'playSongFromId', 'stopPlaying', 'searchData', 'populateCategorySelect',
        'openHotkeyFile', 'saveHotkeyFile', 'openHoldingTankFile', 'saveHoldingTankFile',
      ];
      required.forEach(fn => delete window[fn]);

      expect(registry.validateFunctions()).toBe(false);
      expect(mockDebugLog.warn).toHaveBeenCalledWith(
        expect.stringContaining('Missing'),
        expect.any(Object),
      );
    });

    it('returns true when all required functions are present', () => {
      const required = [
        'playSongFromId', 'stopPlaying', 'searchData', 'populateCategorySelect',
        'openHotkeyFile', 'saveHotkeyFile', 'openHoldingTankFile', 'saveHoldingTankFile',
      ];
      required.forEach(fn => { window[fn] = () => {}; });

      expect(registry.validateFunctions()).toBe(true);

      // Cleanup
      required.forEach(fn => delete window[fn]);
    });
  });

  // ── Query / stats methods ───────────────────────────────────────────

  describe('getRegisteredFunctions', () => {
    it('returns array of registered function names', () => {
      registry.register('testFn', () => {});
      registry.register('anotherFn', () => {});
      const names = registry.getRegisteredFunctions();
      expect(names).toContain('testFn');
      expect(names).toContain('anotherFn');
    });
  });

  describe('isRegistered', () => {
    it('returns true for registered functions', () => {
      registry.register('testFn', () => {});
      expect(registry.isRegistered('testFn')).toBe(true);
    });

    it('returns false for unregistered functions', () => {
      expect(registry.isRegistered('nope')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('returns correct counts', () => {
      registry.register('testFn', () => {});
      registry.register('anotherFn', () => {});
      const stats = registry.getStats();
      expect(stats.totalRegistered).toBe(2);
      expect(stats.registeredFunctions).toHaveLength(2);
    });

    it('reports module count from moduleRegistry', () => {
      registry.setModuleRegistry({ a: {}, b: {}, c: {} });
      expect(registry.getStats().totalModules).toBe(3);
    });

    it('reports 0 modules when no registry set', () => {
      expect(registry.getStats().totalModules).toBe(0);
    });
  });

  // ── setModuleRegistry ───────────────────────────────────────────────

  describe('setModuleRegistry', () => {
    it('stores the module registry', () => {
      const mods = { audio: {}, ui: {} };
      registry.setModuleRegistry(mods);
      expect(registry.moduleRegistry).toBe(mods);
    });
  });
});
