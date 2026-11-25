/**
 * Renderer Error Reporting
 *
 * Decides which uncaught renderer errors are worth sending as `renderer_error`.
 */

/**
 * Whether an error is an intentional cancellation (AbortController), not a bug.
 * Covers "signal is aborted without reason" and "The user aborted a request."
 *
 * @param {*} error - The thrown value or rejection reason
 * @returns {boolean}
 */
export function isAbortError(error) {
  return error?.name === 'AbortError';
}

/**
 * Build `renderer_error` properties, or null when the error should be ignored.
 *
 * @param {*} error - The thrown value or rejection reason
 * @param {string} errorCode - Stable category assigned by the global error handler
 * @returns {{ error_code: string, stack_trace: string|undefined }|null}
 */
export function buildRendererErrorReport(error, errorCode) {
  if (isAbortError(error)) return null;
  return {
    error_code: errorCode,
    stack_trace: error instanceof Error ? error.stack : undefined,
  };
}
