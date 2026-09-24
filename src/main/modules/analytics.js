/**
 * Analytics Module
 *
 * Wraps PostHog Node.js SDK for anonymous product analytics.
 * All tracking calls are no-ops when the user has opted out.
 *
 * @module analytics
 */

import { PostHog } from 'posthog-node';
import { v4 as uuidv4 } from 'uuid';

// PostHog project API key (client-side keys are public by design)
const POSTHOG_API_KEY = 'phc_qJdKChSMdVxUjNJZyx7dnTaeti64Vd2F5R2rvM8iDXkH';
const POSTHOG_HOST = 'https://us.i.posthog.com';

// Error events are throttled so one install stuck in an error loop can't flood
// the project: each distinct message is reported once per session, up to a cap.
const ERROR_EVENTS = new Set(['app_error', 'renderer_error']);
const MAX_ERROR_EVENTS_PER_SESSION = 20;
// Some messages (e.g. electron-updater HTTP errors) embed stacks and headers
const MAX_ERROR_MESSAGE_LENGTH = 300;

/**
 * Reduce an error message to its first line, truncated, so repeats group
 * together and embedded stacks/headers are not sent.
 */
function normalizeErrorMessage(message) {
  if (typeof message !== 'string') return message;
  return message.split('\n')[0].trim().slice(0, MAX_ERROR_MESSAGE_LENGTH);
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
  let optedOut = false;
  let initialized = false;
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
    const key = `${name}:${properties.error_message ?? ''}`;
    if (reportedErrors.has(key) || reportedErrors.size >= MAX_ERROR_EVENTS_PER_SESSION) return true;
    reportedErrors.add(key);
    return false;
  }

  /**
   * Scrub absolute file paths from a stack trace string.
   * Keeps the relative path from the project root onward.
   */
  function scrubStackTrace(stack) {
    if (typeof stack !== 'string') return stack;
    // Replace absolute paths, keeping from src/ or node_modules/ onward
    return stack.replace(/(?:\/[\w.-]+)+\/(src\/)/g, '$1')
               .replace(/(?:\/[\w.-]+)+\/(node_modules\/)/g, '$1')
               .replace(/(?:[A-Z]:\\[\w.-\\]+\\)(src\\)/gi, '$1')
               .replace(/(?:[A-Z]:\\[\w.-\\]+\\)(node_modules\\)/gi, '$1');
  }

  function init() {
    if (initialized) return;

    // Only run analytics in packaged builds unless ANALYTICS_ENABLED=1 is set
    if (!isPackaged && process.env.ANALYTICS_ENABLED !== '1') {
      disabled = true;
      debugLog.info('Analytics disabled (dev/test mode). Set ANALYTICS_ENABLED=1 to override.', {
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

    // Read opt-out preference
    optedOut = !!store.get('analytics_opt_out');
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
      optedOut,
    });
  }

  function trackEvent(name, properties = {}) {
    if (disabled || !initialized || optedOut || !client) return;

    const scrubbed = { ...properties };
    if (ERROR_EVENTS.has(name)) {
      scrubbed.error_message = normalizeErrorMessage(scrubbed.error_message);
    }
    if (shouldThrottleError(name, scrubbed)) return;

    // Scrub stack traces in error events
    if (scrubbed.stack_trace) {
      scrubbed.stack_trace = scrubStackTrace(scrubbed.stack_trace);
    }

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
    optedOut = !!value;
    store.set('analytics_opt_out', optedOut);
    debugLog.info('Analytics opt-out changed', {
      module: 'analytics',
      function: 'setOptOut',
      optedOut,
    });
  }

  function getOptOutStatus() {
    return optedOut;
  }

  async function shutdown() {
    if (client) {
      await client.shutdown();
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
        await shutdown();
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
