import { describe, it, expect, beforeEach, vi } from 'vitest';

globalThis.window = globalThis.window || {};

const { default: EventManager } = await import(
  '../../../src/renderer/event-manager.js'
);

const mockDebugLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Minimal DOM stubs for migrateOnclick
function makeElement(onclickAttr) {
  const listeners = [];
  return {
    getAttribute: vi.fn(() => onclickAttr),
    addEventListener: vi.fn((_, handler) => listeners.push(handler)),
    removeAttribute: vi.fn(),
    _listeners: listeners,
  };
}

describe('EventManager', () => {
  let em;

  beforeEach(() => {
    em = new EventManager(null, null);
    em.setDebugLogger(mockDebugLog);
    vi.clearAllMocks();
  });

  // ── Constructor ─────────────────────────────────────────────────────

  describe('constructor', () => {
    it('starts uninitialized with empty handler map', () => {
      const e = new EventManager(null);
      expect(e.initialized).toBe(false);
      expect(e.eventHandlers.size).toBe(0);
    });
  });

  // ── setDebugLogger / ensureDebugLogger ──────────────────────────────

  describe('setDebugLogger', () => {
    it('sets the logger', () => {
      const e = new EventManager(null);
      e.setDebugLogger(mockDebugLog);
      expect(e.debugLog).toBe(mockDebugLog);
    });

    it('throws if null is passed', () => {
      const e = new EventManager(null);
      expect(() => e.setDebugLogger(null)).toThrow(/requires a valid debug logger/);
    });
  });

  describe('ensureDebugLogger', () => {
    it('throws when no logger is set', () => {
      const e = new EventManager(null);
      expect(() => e.ensureDebugLogger()).toThrow(/DebugLogger not initialized/);
    });

    it('does not throw when logger exists', () => {
      expect(() => em.ensureDebugLogger()).not.toThrow();
    });
  });

  // ── migrateOnclick ──────────────────────────────────────────────────

  describe('migrateOnclick', () => {
    it('replaces onclick with addEventListener and removes the attribute', () => {
      const el = makeElement('openFile()');
      globalThis.document = {
        ...globalThis.document,
        querySelector: vi.fn(() => el),
      };

      em.migrateOnclick('openFile', 'testSetup');

      expect(globalThis.document.querySelector).toHaveBeenCalledWith('[onclick="openFile()"]');
      expect(el.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(el.removeAttribute).toHaveBeenCalledWith('onclick');
    });

    it('does nothing if element is not found', () => {
      globalThis.document = {
        ...globalThis.document,
        querySelector: vi.fn(() => null),
      };

      // Should not throw
      em.migrateOnclick('nonExistent', 'testSetup');
    });

    it('click handler calls window[fnName] when available', () => {
      const el = makeElement('myAction()');
      globalThis.document = {
        ...globalThis.document,
        querySelector: vi.fn(() => el),
      };
      window.myAction = vi.fn();

      em.migrateOnclick('myAction', 'testSetup');

      // Simulate click
      el._listeners[0]();
      expect(window.myAction).toHaveBeenCalled();

      delete window.myAction;
    });

    it('click handler warns when window[fnName] is not available', () => {
      const el = makeElement('missing()');
      globalThis.document = {
        ...globalThis.document,
        querySelector: vi.fn(() => el),
      };
      delete window.missing;

      em.migrateOnclick('missing', 'testContext');

      // Simulate click
      el._listeners[0]();
      expect(mockDebugLog.warn).toHaveBeenCalledWith(
        expect.stringContaining('missing'),
        expect.objectContaining({ function: 'testContext' }),
      );
    });
  });

  // ── initialize ──────────────────────────────────────────────────────

  describe('initialize', () => {
    it('marks as initialized', () => {
      // Provide minimal DOM stubs for setupEventListeners
      globalThis.document = {
        ...globalThis.document,
        readyState: 'complete',
        getElementById: vi.fn(() => null),
        querySelector: vi.fn(() => null),
        querySelectorAll: vi.fn(() => []),
        body: { childList: true },
      };
      // MutationObserver stub — must be a real constructor
      globalThis.MutationObserver = class {
        observe() {}
      };

      em.initialize();
      expect(em.initialized).toBe(true);
    });

    it('warns on double initialization', () => {
      globalThis.document = {
        ...globalThis.document,
        readyState: 'complete',
        getElementById: vi.fn(() => null),
        querySelector: vi.fn(() => null),
        querySelectorAll: vi.fn(() => []),
        body: {},
      };
      globalThis.MutationObserver = class {
        observe() {}
      };

      em.initialize();
      vi.clearAllMocks();
      em.initialize();

      expect(mockDebugLog.warn).toHaveBeenCalledWith(
        expect.stringContaining('already initialized'),
        expect.any(Object),
      );
    });
  });

  // ── getStats ────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns initialization status and counts', () => {
      globalThis.document = {
        ...globalThis.document,
        querySelectorAll: vi.fn(() => []),
      };

      const stats = em.getStats();
      expect(stats).toHaveProperty('initialized', false);
      expect(stats).toHaveProperty('eventHandlers', 0);
      expect(stats).toHaveProperty('totalElements');
    });
  });
});
