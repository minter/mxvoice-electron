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

  describe('error event throttling', () => {
    it('reports a repeated error message only once per session', () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      for (let i = 0; i < 5; i++) {
        analytics.trackEvent('renderer_error', { error_message: 'boom' });
      }

      expect(mockCapture).toHaveBeenCalledTimes(1);
    });

    it('reports distinct error messages and event types separately', () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      analytics.trackEvent('renderer_error', { error_message: 'boom' });
      analytics.trackEvent('renderer_error', { error_message: 'bang' });
      analytics.trackEvent('app_error', { error_message: 'boom' });

      expect(mockCapture).toHaveBeenCalledTimes(3);
    });

    it('caps total error events per session', () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      for (let i = 0; i < 100; i++) {
        analytics.trackEvent('renderer_error', { error_message: `error ${i}` });
      }

      expect(mockCapture).toHaveBeenCalledTimes(20);
    });

    it('sends only the first line of an error message, truncated', () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      analytics.trackEvent('app_error', { error_message: `${'x'.repeat(400)}\nHeaders: {"date": "today"}` });

      const sent = mockCapture.mock.calls[0][0].properties.error_message;
      expect(sent).toBe('x'.repeat(300));
    });

    it('groups messages that differ only after the first line', () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      analytics.trackEvent('app_error', { error_message: 'Cannot find latest.yml: 404\n"date": "Mon"' });
      analytics.trackEvent('app_error', { error_message: 'Cannot find latest.yml: 404\n"date": "Tue"' });

      expect(mockCapture).toHaveBeenCalledTimes(1);
    });

    it('does not throttle non-error events', () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      for (let i = 0; i < 30; i++) {
        analytics.trackEvent('song_played', { trigger_method: 'hotkey' });
      }

      expect(mockCapture).toHaveBeenCalledTimes(30);
    });
  });

  describe('internal user tagging', () => {
    it('tags the person as internal on the first event when the store flag is set', () => {
      storeData.analytics_internal_user = true;
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      analytics.trackEvent('app_launched', {});
      analytics.trackEvent('song_played', {});

      expect(mockCapture.mock.calls[0][0].properties.$set).toEqual({ $internal_or_test_user: true });
      expect(mockCapture.mock.calls[1][0].properties.$set).toBeUndefined();
    });

    it('tags dev builds running with ANALYTICS_ENABLED=1 as internal', () => {
      const originalEnv = process.env.ANALYTICS_ENABLED;
      process.env.ANALYTICS_ENABLED = '1';
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: false });
      analytics.init();

      analytics.trackEvent('app_launched', {});

      expect(mockCapture.mock.calls[0][0].properties.$set).toEqual({ $internal_or_test_user: true });
      process.env.ANALYTICS_ENABLED = originalEnv;
    });

    it('merges the internal tag with person properties the event already sets', () => {
      storeData.analytics_internal_user = true;
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      analytics.trackEvent('app_launched', { $set: { os: 'win32' } });

      expect(mockCapture.mock.calls[0][0].properties.$set).toEqual({ os: 'win32', $internal_or_test_user: true });
    });

    it('does not tag regular installs', () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      analytics.trackEvent('app_launched', {});

      expect(mockCapture.mock.calls[0][0].properties.$set).toBeUndefined();
    });

    it('passes through person properties for regular installs', () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      analytics.trackEvent('app_launched', { $set: { os: 'win32', app_version: '1.0.0' } });

      expect(mockCapture.mock.calls[0][0].properties.$set).toEqual({ os: 'win32', app_version: '1.0.0' });
    });
  });

  describe('endSession', () => {
    it('sends app_closed with the session duration, then flushes', async () => {
      const analytics = createAnalytics({
        store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true,
        sessionStartTime: Date.now() - 90_000,
      });
      analytics.init();

      await analytics.endSession();

      expect(mockCapture).toHaveBeenCalledWith(expect.objectContaining({
        event: 'app_closed',
        properties: expect.objectContaining({ session_duration_seconds: 90 }),
      }));
      expect(mockShutdown).toHaveBeenCalledOnce();
      expect(mockCapture.mock.invocationCallOrder[0]).toBeLessThan(mockShutdown.mock.invocationCallOrder[0]);
    });

    it('only ends the session once when called from several exit paths', async () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      await Promise.all([analytics.endSession(), analytics.endSession()]);
      await analytics.endSession();

      expect(mockCapture).toHaveBeenCalledTimes(1);
      expect(mockShutdown).toHaveBeenCalledOnce();
    });

    it('is a no-op when analytics is disabled', async () => {
      const originalEnv = process.env.ANALYTICS_ENABLED;
      delete process.env.ANALYTICS_ENABLED;
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: false });
      analytics.init();

      await expect(analytics.endSession()).resolves.toBeUndefined();
      expect(mockShutdown).not.toHaveBeenCalled();
      process.env.ANALYTICS_ENABLED = originalEnv;
    });

    it('logs instead of throwing when the flush fails', async () => {
      mockShutdown.mockRejectedValueOnce(new Error('offline'));
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      await expect(analytics.endSession()).resolves.toBeUndefined();
      expect(mockDebugLog.error).toHaveBeenCalled();
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
