/**
 * Analytics Module
 *
 * Wraps PostHog Node.js SDK for consent-based product analytics.
 * All tracking calls are no-ops until the user has affirmatively consented.
 *
 * @module analytics
 */

import { PostHog } from 'posthog-node';
import { v4 as uuidv4 } from 'uuid';

// PostHog project API key (client-side keys are public by design)
const POSTHOG_API_KEY = 'phc_qJdKChSMdVxUjNJZyx7dnTaeti64Vd2F5R2rvM8iDXkH';
const POSTHOG_HOST = 'https://us.i.posthog.com';

// Error events are throttled so one install stuck in an error loop can't flood
// the project: each distinct safe diagnostic is reported once per session, up to a cap.
const ERROR_EVENTS = new Set(['app_error', 'renderer_error']);
const ALLOWED_ERROR_CODES = new Set([
  'main_uncaught_exception',
  'main_unhandled_rejection',
  'renderer_uncaught_exception',
  'renderer_unhandled_rejection',
]);
const DEFAULT_ERROR_CODES = {
  app_error: 'main_uncaught_exception',
  renderer_error: 'renderer_uncaught_exception',
};
const MAX_ERROR_EVENTS_PER_SESSION = 20;
const MAX_APP_STACK_FRAMES = 10;
const APP_STACK_LOCATION = /(?:^|[/(])(src\/(?:(?:main|renderer|preload|shared)(?:\/[A-Za-z0-9_][A-Za-z0-9_.-]*)+|(?:launcher|renderer)\.js)(?::\d+){0,2})\)?\s*$/;
// Bound the final flush on exit: posthog-node defaults to 30s with retries,
// which would stall quitting or switching profiles when offline
const SESSION_END_FLUSH_TIMEOUT_MS = 3000;

/**
 * Reduce a stack to allowlisted app-relative source locations. Every other
 * frame is dropped rather than trying to redact an unknown absolute path.
 */
function reduceStackTrace(stack) {
  if (typeof stack !== 'string') return undefined;
  const frames = stack.split('\n')
    .map((line) => line.replace(/\\/g, '/').match(APP_STACK_LOCATION)?.[1])
    .filter(Boolean)
    .slice(0, MAX_APP_STACK_FRAMES);
  return frames.length ? frames.join('\n') : undefined;
}

/**
 * Error telemetry accepts only a stable category and safe app source frames.
 * Raw messages and all other caller-supplied properties are intentionally dropped.
 */
function reduceErrorProperties(name, properties) {
  const requestedCode = properties?.error_code;
  const errorCode = ALLOWED_ERROR_CODES.has(requestedCode)
    ? requestedCode
    : DEFAULT_ERROR_CODES[name];
  const stackTrace = reduceStackTrace(properties?.stack_trace);
  return {
    error_code: errorCode,
    ...(stackTrace && { stack_trace: stackTrace }),
  };
}

/**
 * Create an analytics instance.
 *
 * @param {Object} options
 * @param {Object} options.store - electron-store instance
 * @param {Object} options.debugLog - debug log instance
 * @param {string} options.appVersion - current app version string
 * @param {number} [options.sessionStartTime] - epoch ms the app started, for app_closed duration
 * @returns {Object} analytics interface
 */
export function createAnalytics({ store, debugLog, appVersion, isPackaged, sessionStartTime = Date.now() }) {
  let client = null;
  let deviceId = null;
  let initialized = false;
  let initializationRequested = false;
  let disabled = false;
  const reportedErrors = new Set();
  let sessionEnd = null;
  // Dev builds and installs with analytics_internal_user set are tagged so the
  // project's "Internal / Test users" cohort filters them out of dashboards.
  let pendingInternalTag = false;

  /**
   * Returns true when an error event should be dropped as a repeat or over the cap.
   */
  function shouldThrottleError(name, properties) {
    if (!ERROR_EVENTS.has(name)) return false;
    const key = `${name}:${properties.error_code}:${properties.stack_trace ?? ''}`;
    if (reportedErrors.has(key) || reportedErrors.size >= MAX_ERROR_EVENTS_PER_SESSION) return true;
    reportedErrors.add(key);
    return false;
  }

  function hasAffirmativeConsent() {
    return store.get('analytics_banner_shown') === true
      && store.get('analytics_opt_out') === false;
  }

  function init() {
    initializationRequested = true;
    if (initialized || disabled) return;

    // Only run analytics in packaged builds unless ANALYTICS_ENABLED=1 is set
    if (!isPackaged && process.env.ANALYTICS_ENABLED !== '1') {
      disabled = true;
      debugLog.info('Analytics disabled (dev/test mode). Set ANALYTICS_ENABLED=1 to override.', {
        module: 'analytics',
        function: 'init',
      });
      return;
    }

    // Do not create an identifier or remote client before a stored affirmative choice.
    if (!hasAffirmativeConsent()) {
      debugLog.info('Analytics awaiting consent', {
        module: 'analytics',
        function: 'init',
      });
      return;
    }

    // Get or create device ID
    deviceId = store.get('analytics_device_id');
    if (!deviceId) {
      deviceId = uuidv4();
      store.set('analytics_device_id', deviceId);
    }

    pendingInternalTag = !isPackaged || !!store.get('analytics_internal_user');

    // Initialize PostHog client
    client = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      flushAt: 20,
      flushInterval: 30000,
    });

    initialized = true;
    debugLog.info('Analytics initialized', {
      module: 'analytics',
      function: 'init',
      deviceId,
      optedOut: false,
    });
  }

  function trackEvent(name, properties = {}) {
    // This is the shared enforcement boundary for main and renderer callers.
    if (disabled || !initializationRequested || !hasAffirmativeConsent()) return;
    // Consent may have been granted after startup; initialize on the first later event.
    if (!initialized) init();
    if (!initialized || !client) return;

    const scrubbed = ERROR_EVENTS.has(name)
      ? reduceErrorProperties(name, properties)
      : { ...properties };
    if (shouldThrottleError(name, scrubbed)) return;

    client.capture({
      distinctId: deviceId,
      event: name,
      properties: {
        ...scrubbed,
        app_version: appVersion,
        ...(pendingInternalTag && { $set: { ...scrubbed.$set, $internal_or_test_user: true } }),
      },
    });
    pendingInternalTag = false;
  }

  function setOptOut(value) {
    const optedOut = !!value;
    store.set('analytics_opt_out', optedOut);
    debugLog.info('Analytics opt-out changed', {
      module: 'analytics',
      function: 'setOptOut',
      optedOut,
    });
  }

  function getOptOutStatus() {
    return !!store.get('analytics_opt_out');
  }

  async function shutdown(timeoutMs) {
    if (client) {
      await client.shutdown(timeoutMs);
      client = null;
      initialized = false;
      debugLog.info('Analytics shut down', {
        module: 'analytics',
        function: 'shutdown',
      });
    }
  }

  /**
   * Send app_closed and flush queued events. Safe to call from every exit
   * path (normal quit, profile switch, restart); only the first call runs.
   * `app.exit()` skips before-quit, so callers must await this first.
   */
  function endSession() {
    if (sessionEnd) return sessionEnd;
    sessionEnd = (async () => {
      if (!client) return;
      trackEvent('app_closed', {
        session_duration_seconds: Math.floor((Date.now() - sessionStartTime) / 1000),
      });
      try {
        await shutdown(SESSION_END_FLUSH_TIMEOUT_MS);
      } catch (error) {
        debugLog.error('Analytics shutdown error', {
          module: 'analytics', function: 'endSession', error: error.message,
        });
      }
    })();
    return sessionEnd;
  }

  return { init, trackEvent, setOptOut, getOptOutStatus, shutdown, endSession };
}
