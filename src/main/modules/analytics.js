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

/**
 * Create an analytics instance.
 *
 * @param {Object} options
 * @param {Object} options.store - electron-store instance
 * @param {Object} options.debugLog - debug log instance
 * @param {string} options.appVersion - current app version string
 * @returns {Object} analytics interface
 */
export function createAnalytics({ store, debugLog, appVersion, isPackaged }) {
  let client = null;
  let deviceId = null;
  let optedOut = false;
  let initialized = false;
  let disabled = false;

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

    // Scrub stack traces in error events
    const scrubbed = { ...properties };
    if (scrubbed.stack_trace) {
      scrubbed.stack_trace = scrubStackTrace(scrubbed.stack_trace);
    }

    client.capture({
      distinctId: deviceId,
      event: name,
      properties: {
        ...scrubbed,
        app_version: appVersion,
      },
    });
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

  return { init, trackEvent, setOptOut, getOptOutStatus, shutdown };
}
