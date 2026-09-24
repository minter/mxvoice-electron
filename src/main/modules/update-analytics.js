/**
 * Update Analytics
 *
 * Classifies auto-updater errors for the `update_failed` analytics event.
 * Only a code is reported: updater messages embed URLs, HTTP headers, and
 * stacks with local paths.
 *
 * @module update-analytics
 */

// Being offline (common at live-event venues) is not an updater problem
const OFFLINE_PATTERN =
  /net::ERR_(INTERNET_DISCONNECTED|NETWORK_CHANGED|NAME_NOT_RESOLVED|CONNECTION_TIMED_OUT|CONNECTION_REFUSED|CONNECTION_RESET|ADDRESS_UNREACHABLE|PROXY_CONNECTION_FAILED)|\b(ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENETUNREACH)\b/;

/**
 * @param {Error|undefined} error - Error emitted by electron-updater
 * @param {Object} [context]
 * @param {boolean} [context.downloading] - Whether an update download was in progress
 * @returns {{ error_code: string, stage: 'check'|'download' }|null} Event properties,
 *   or null to skip offline errors
 */
export function describeUpdateError(error, { downloading = false } = {}) {
  const code = typeof error?.code === 'string' ? error.code : null;
  if (OFFLINE_PATTERN.test(`${code ?? ''} ${error?.message ?? ''}`)) return null;
  // The updater's 'error' event covers both checking and downloading
  const stage = downloading ? 'download' : 'check';
  if (code) return { error_code: code, stage };
  if (error?.statusCode) return { error_code: `HTTP_${error.statusCode}`, stage };
  return { error_code: 'unknown', stage };
}
