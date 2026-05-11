/**
 * Unit tests for analytics module.
 *
 * Mocks posthog-node and electron-store to test:
 * - Initialization and device ID generation
 * - Event tracking when opted in
 * - Event suppression when opted out
 * - Stack trace scrubbing
 * - Shutdown/flush behavior
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock posthog-node
const mockCapture = vi.fn();
const mockShutdown = vi.fn().mockResolvedValue(undefined);
const mockPostHogInstance = {
  capture: mockCapture,
  shutdown: mockShutdown,
};

vi.mock('posthog-node', () => ({
  PostHog: vi.fn(function () { return mockPostHogInstance; }),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-1234'),
}));

// In-memory store
let storeData = {};
const mockStore = {
  get: vi.fn((key) => storeData[key]),
  set: vi.fn((key, value) => { storeData[key] = value; }),
};

const mockDebugLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Import after mocks
const { createAnalytics } = await import('../../../src/main/modules/analytics.js');

describe('analytics module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeData = {};
    mockCapture.mockClear();
    mockShutdown.mockClear();
  });

  describe('init', () => {
    it('generates a device ID on first init when none exists', () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      expect(mockStore.set).toHaveBeenCalledWith('analytics_device_id', 'test-uuid-1234');
    });

    it('reuses existing device ID if already stored', () => {
      storeData.analytics_device_id = 'existing-device-id';
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      expect(mockStore.set).not.toHaveBeenCalledWith('analytics_device_id', expect.anything());
    });
  });

  describe('trackEvent', () => {
    it('sends event to PostHog when opted in', () => {
      storeData.analytics_opt_out = false;
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      analytics.trackEvent('song_played', { trigger_method: 'hotkey' });

      expect(mockCapture).toHaveBeenCalledWith({
        distinctId: 'test-uuid-1234',
        event: 'song_played',
        properties: expect.objectContaining({
          trigger_method: 'hotkey',
          app_version: '1.0.0',
        }),
      });
    });

    it('does not send event when opted out', () => {
      storeData.analytics_opt_out = true;
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      analytics.trackEvent('song_played', { trigger_method: 'hotkey' });

      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('does not send event before init is called', () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });

      analytics.trackEvent('song_played', { trigger_method: 'hotkey' });

      expect(mockCapture).not.toHaveBeenCalled();
    });
  });

  describe('opt-out', () => {
    it('setOptOut(true) persists to store and suppresses events', () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      analytics.setOptOut(true);

      expect(mockStore.set).toHaveBeenCalledWith('analytics_opt_out', true);

      analytics.trackEvent('song_played', {});
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('setOptOut(false) re-enables tracking', () => {
      storeData.analytics_opt_out = true;
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      analytics.setOptOut(false);
      analytics.trackEvent('song_played', {});

      expect(mockCapture).toHaveBeenCalled();
    });

    it('getOptOutStatus returns current state', () => {
      storeData.analytics_opt_out = true;
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      expect(analytics.getOptOutStatus()).toBe(true);
    });
  });

  describe('scrubStackTrace', () => {
    it('removes absolute file paths from stack traces', () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      analytics.trackEvent('app_error', {
        stack_trace: 'Error: fail\n    at Object.<anonymous> (/Users/john/projects/mxvoice/src/main/index.js:42:5)',
      });

      const capturedProps = mockCapture.mock.calls[0][0].properties;
      expect(capturedProps.stack_trace).not.toContain('/Users/john');
      expect(capturedProps.stack_trace).toContain('src/main/index.js:42:5');
    });
  });

  describe('shutdown', () => {
    it('flushes PostHog client on shutdown', async () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      await analytics.shutdown();

      expect(mockShutdown).toHaveBeenCalled();
    });
  });

  describe('dev mode gating', () => {
    it('disables analytics when not packaged and ANALYTICS_ENABLED is not set', () => {
      const originalEnv = process.env.ANALYTICS_ENABLED;
      delete process.env.ANALYTICS_ENABLED;

      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: false });
      analytics.init();

      analytics.trackEvent('song_played', {});
      expect(mockCapture).not.toHaveBeenCalled();

      process.env.ANALYTICS_ENABLED = originalEnv;
    });

    it('enables analytics when not packaged but ANALYTICS_ENABLED=1 is set', () => {
      const originalEnv = process.env.ANALYTICS_ENABLED;
      process.env.ANALYTICS_ENABLED = '1';

      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: false });
      analytics.init();

      analytics.trackEvent('song_played', {});
      expect(mockCapture).toHaveBeenCalled();

      process.env.ANALYTICS_ENABLED = originalEnv;
    });
  });
});
