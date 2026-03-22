/**
 * Unit tests for FunctionMonitor.
 *
 * Verifies interval lifecycle (start/stop), leak prevention,
 * and the Set-based change monitoring approach.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// We need a minimal window-like global for the monitor to inspect
const windowFunctions = {};
globalThis.window = new Proxy(windowFunctions, {
  get(target, prop) {
    if (prop === Symbol.toPrimitive || prop === Symbol.toStringTag) return undefined;
    return target[prop];
  },
  set(target, prop, value) {
    target[prop] = value;
    return true;
  },
  deleteProperty(target, prop) {
    delete target[prop];
    return true;
  },
  ownKeys(target) {
    return Object.keys(target);
  },
  getOwnPropertyDescriptor(target, prop) {
    if (prop in target) {
      return { value: target[prop], writable: true, enumerable: true, configurable: true };
    }
    return undefined;
  },
});

// Import after window is set up
const { default: FunctionMonitor } = await import(
  '../../../src/renderer/function-monitor.js'
);

const mockDebugLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const mockRegistry = {
  moduleRegistry: {},
};

let monitor;

beforeEach(() => {
  vi.useFakeTimers();
  // Reset window functions
  Object.keys(windowFunctions).forEach(k => delete windowFunctions[k]);
  // Seed a few functions
  windowFunctions.testFn = () => {};
  windowFunctions.anotherFn = () => {};

  monitor = new FunctionMonitor(mockRegistry, mockDebugLog);
  mockDebugLog.info.mockClear();
  mockDebugLog.warn.mockClear();
  mockDebugLog.error.mockClear();
});

afterEach(() => {
  if (monitor.monitoring) {
    monitor.stopMonitoring();
  }
  vi.useRealTimers();
});

describe('FunctionMonitor interval lifecycle', () => {
  it('stores both interval IDs when starting', () => {
    monitor.startMonitoring();
    expect(monitor.healthCheckInterval).not.toBeNull();
    expect(monitor.changeMonitorInterval).not.toBeNull();
  });

  it('clears both intervals when stopping', () => {
    monitor.startMonitoring();
    monitor.stopMonitoring();
    expect(monitor.healthCheckInterval).toBeNull();
    expect(monitor.changeMonitorInterval).toBeNull();
    expect(monitor.trackedFunctionNames).toBeNull();
  });

  it('does not leak intervals on repeated start/stop cycles', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');

    monitor.startMonitoring();
    monitor.stopMonitoring();
    monitor.startMonitoring();
    monitor.stopMonitoring();

    // Should have cleared 4 intervals total (2 per stop: health + change)
    expect(clearSpy.mock.calls.length).toBe(4);
    clearSpy.mockRestore();
  });

  it('skips start if already monitoring', () => {
    monitor.startMonitoring();
    const firstHealthInterval = monitor.healthCheckInterval;
    const firstChangeInterval = monitor.changeMonitorInterval;

    monitor.startMonitoring(); // second call should be no-op
    expect(monitor.healthCheckInterval).toBe(firstHealthInterval);
    expect(monitor.changeMonitorInterval).toBe(firstChangeInterval);
    expect(mockDebugLog.warn).toHaveBeenCalledWith(
      'Function monitoring already active',
      expect.any(Object)
    );
  });
});

describe('FunctionMonitor change detection', () => {
  it('uses Set for tracking (not object spread of window)', () => {
    monitor.startMonitoring();
    expect(monitor.trackedFunctionNames).toBeInstanceOf(Set);
    expect(monitor.trackedFunctionNames.has('testFn')).toBe(true);
    expect(monitor.trackedFunctionNames.has('anotherFn')).toBe(true);
  });

  it('detects new functions added after monitoring starts', () => {
    monitor.startMonitoring();
    mockDebugLog.info.mockClear();

    // Add a new function
    windowFunctions.brandNewFn = () => {};

    // Advance past the 10-second interval
    vi.advanceTimersByTime(10001);

    expect(mockDebugLog.info).toHaveBeenCalledWith(
      'New functions detected:',
      expect.objectContaining({
        data: expect.objectContaining({
          newFunctions: expect.arrayContaining(['brandNewFn']),
        }),
      })
    );
  });

  it('detects removed functions after monitoring starts', () => {
    monitor.startMonitoring();
    mockDebugLog.warn.mockClear();

    // Remove a function
    delete windowFunctions.testFn;

    vi.advanceTimersByTime(10001);

    expect(mockDebugLog.warn).toHaveBeenCalledWith(
      'Functions removed:',
      expect.objectContaining({
        data: expect.objectContaining({
          removedFunctions: expect.arrayContaining(['testFn']),
        }),
      })
    );
  });

  it('updates tracked set after each check cycle', () => {
    monitor.startMonitoring();

    // Add a function and tick
    windowFunctions.newFn = () => {};
    vi.advanceTimersByTime(10001);
    mockDebugLog.info.mockClear();

    // Second tick should not re-report newFn
    vi.advanceTimersByTime(10001);
    const infoCalls = mockDebugLog.info.mock.calls.filter(
      c => c[0] === 'New functions detected:'
    );
    expect(infoCalls.length).toBe(0);
  });
});

describe('FunctionMonitor health checks', () => {
  it('performs initial health check on start', () => {
    monitor.startMonitoring();
    // performHealthCheck is called in startMonitoring, which stores to healthChecks map
    expect(monitor.healthChecks.size).toBe(1);
  });

  it('accumulates health checks over time', () => {
    monitor.startMonitoring();
    // Advance past two 30-second intervals
    vi.advanceTimersByTime(60001);
    expect(monitor.healthChecks.size).toBe(3); // initial + 2 periodic
  });

  it('reports missing critical functions', () => {
    // Don't register any critical functions on window
    monitor.startMonitoring();
    const missing = monitor.getMissingCriticalFunctions();
    expect(missing.length).toBe(monitor.criticalFunctions.length);
  });
});
