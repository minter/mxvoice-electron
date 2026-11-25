/**
 * Unit tests for analytics module.
 *
 * Mocks posthog-node and electron-store to test:
 * - Initialization and device ID generation
 * - Event tracking when opted in
 * - Event suppression when opted out
 * - Safe error diagnostic reduction
 * - Shutdown/flush behavior
 */
import os from 'os';
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
const { PostHog } = await import('posthog-node');

describe('analytics module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeData = { analytics_banner_shown: true, analytics_opt_out: false };
    mockCapture.mockClear();
    mockShutdown.mockClear();
  });

  describe('init', () => {
    it('does not create an identifier or PostHog client before affirmative consent', () => {
      storeData.analytics_banner_shown = false;
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });

      analytics.init();
      analytics.trackEvent('library_stats', { song_count: 2 });

      expect(mockStore.set).not.toHaveBeenCalledWith('analytics_device_id', expect.anything());
      expect(PostHog).not.toHaveBeenCalled();
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('rejects a malformed stored consent state', () => {
      storeData.analytics_opt_out = 'false';
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });

      analytics.init();
      analytics.trackEvent('library_stats', { song_count: 2 });

      expect(PostHog).not.toHaveBeenCalled();
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('initializes on the first event after consent is granted', () => {
      storeData.analytics_banner_shown = false;
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      storeData.analytics_banner_shown = true;
      analytics.trackEvent('song_played', { trigger_method: 'hotkey' });

      expect(PostHog).toHaveBeenCalledOnce();
      expect(mockCapture).toHaveBeenCalledWith(expect.objectContaining({ event: 'song_played' }));
    });

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

  describe('error diagnostics', () => {
    it('keeps the first line of the message with paths redacted, and app-relative frames', () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      analytics.trackEvent('app_error', {
        error_code: 'main_uncaught_exception',
        error_message: 'Failed to open /Users/Zoë Smith/private/audio.mp3\n    at second line',
        stack_trace: 'Error: /Users/Zoë Smith/private/audio.mp3\n    at load (file:///Users/Zoë Smith/Mx Voice/src/main/index.js:42:5)',
      });

      const capturedProps = mockCapture.mock.calls[0][0].properties;
      expect(capturedProps).toMatchObject({
        error_code: 'main_uncaught_exception',
        error_message: 'Failed to open <path>',
        stack_trace: 'src/main/index.js:42:5',
      });
      expect(JSON.stringify(capturedProps)).not.toContain('Zoë');
      expect(JSON.stringify(capturedProps)).not.toContain('Smith');
    });

    it.each([
      ['ENOENT: no such file or directory, open \'/Users/alice/My Music/a b.mp3\'', 'ENOENT: no such file or directory, open <path>'],
      ['ENOENT: no such file or directory, open "C:\\Users\\Renée Smith\\a.mp3"', 'ENOENT: no such file or directory, open <path>'],
      ['Cannot load C:\\Users\\Renée Smith\\Mx Voice\\x.js', 'Cannot load <path>'],
      ['Failed to fetch file:///Users/alice/My Music/a.mp3', 'Failed to fetch <path>'],
      ['(/Volumes/Shows/Spring Gala/a.mp3) is missing', '(<path>'],
      ['Cannot read properties of undefined (reading \'title\')', 'Cannot read properties of undefined (reading \'title\')'],
      ['Unexpected token < in JSON at position 0', 'Unexpected token < in JSON at position 0'],
      ['Request failed with application/json', 'Request failed with application/json'],
    ])('redacts local paths in a message: %s', (message, expected) => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      analytics.trackEvent('renderer_error', { error_code: 'renderer_uncaught_exception', error_message: message });

      expect(mockCapture.mock.calls[0][0].properties.error_message).toBe(expected);
    });

    it('redacts the home directory wherever it appears', async () => {
      const home = os.homedir();
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      analytics.trackEvent('app_error', { error_code: 'main_uncaught_exception', error_message: `bad config in ${home}x, see ${home}` });

      const message = mockCapture.mock.calls[0][0].properties.error_message;
      expect(message).not.toContain(home);
    });

    it('caps the message length and ignores a missing or non-string message', () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      analytics.trackEvent('app_error', { error_code: 'main_uncaught_exception', error_message: 'x'.repeat(1000) });
      analytics.trackEvent('renderer_error', { error_code: 'renderer_uncaught_exception', error_message: 42 });

      expect(mockCapture.mock.calls[0][0].properties.error_message).toHaveLength(300);
      expect(mockCapture.mock.calls[1][0].properties).not.toHaveProperty('error_message');
    });

    it('handles Windows paths and drops frames that are not safe app source locations', () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      analytics.trackEvent('renderer_error', {
        error_code: 'renderer_unhandled_rejection',
        stack_trace: [
          'Error: failed',
          '    at play (C:\\Users\\Renée Smith\\Mx Voice\\src\\renderer\\audio.js:7:9)',
          '    at dependency (C:\\Users\\Renée Smith\\Mx Voice\\node_modules\\pkg\\index.js:2:1)',
          '    at unsafe (C:\\Users\\Renée Smith\\Mx Voice\\src\\..\\private.txt:1:1)',
          '    at unrelated (C:\\Users\\Renée Smith\\other\\src\\Users\\alice.js:1:1)',
        ].join('\n'),
      });

      expect(mockCapture.mock.calls[0][0].properties.stack_trace).toBe('src/renderer/audio.js:7:9');
    });

    it('replaces unrecognized error codes and drops other caller-supplied fields', () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      analytics.trackEvent('renderer_error', {
        error_code: '/Users/alice/private',
        filename: '/Users/alice/private/audio.mp3',
      });

      expect(mockCapture.mock.calls[0][0].properties).toEqual({
        error_code: 'renderer_uncaught_exception',
        app_version: '1.0.0',
      });
    });
  });

  describe('error event throttling', () => {
    it('reports a repeated safe diagnostic only once per session', () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      for (let i = 0; i < 5; i++) {
        analytics.trackEvent('renderer_error', { error_code: 'renderer_uncaught_exception' });
      }

      expect(mockCapture).toHaveBeenCalledTimes(1);
    });

    it('reports distinct safe locations and event types separately', () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      analytics.trackEvent('renderer_error', { error_code: 'renderer_uncaught_exception', stack_trace: 'at first (/app/src/renderer/one.js:1:1)' });
      analytics.trackEvent('renderer_error', { error_code: 'renderer_uncaught_exception', stack_trace: 'at second (/app/src/renderer/two.js:2:2)' });
      analytics.trackEvent('app_error', { error_code: 'main_uncaught_exception', stack_trace: 'at first (/app/src/main/one.js:1:1)' });

      expect(mockCapture).toHaveBeenCalledTimes(3);
    });

    it('caps total error events per session', () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      for (let i = 0; i < 100; i++) {
        analytics.trackEvent('renderer_error', {
          error_code: 'renderer_uncaught_exception',
          stack_trace: `at frame (/app/src/renderer/error-${i}.js:1:1)`,
        });
      }

      expect(mockCapture).toHaveBeenCalledTimes(20);
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

    it('caps the final flush so an offline exit or profile switch cannot stall for 30s', async () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0', isPackaged: true });
      analytics.init();

      await analytics.endSession();

      expect(mockShutdown).toHaveBeenCalledWith(3000);
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
