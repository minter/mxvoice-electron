import { describe, expect, it } from 'vitest';
import { buildRendererErrorReport, isAbortError } from '../../../src/renderer/modules/analytics/error-reporting.js';

function abortError(message) {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

describe('renderer error reporting', () => {
  it('recognizes intentional cancellations', () => {
    expect(isAbortError(abortError('signal is aborted without reason'))).toBe(true);
    expect(isAbortError(abortError('The user aborted a request.'))).toBe(true);
    expect(isAbortError(new Error('boom'))).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
  });

  it('ignores abort errors', () => {
    expect(buildRendererErrorReport(abortError('The user aborted a request.'))).toBeNull();
  });

  it('reports Error instances with a stable code, the message and the stack', () => {
    const error = new Error('boom');
    expect(buildRendererErrorReport(error, 'renderer_uncaught_exception')).toEqual({
      error_code: 'renderer_uncaught_exception',
      error_message: 'boom',
      stack_trace: error.stack,
    });
  });

  it('uses the fallback message, then the value itself, when there is no Error', () => {
    expect(buildRendererErrorReport(null, 'renderer_uncaught_exception', 'Script error.')).toEqual({
      error_code: 'renderer_uncaught_exception',
      error_message: 'Script error.',
      stack_trace: undefined,
    });
    expect(buildRendererErrorReport('rejected with text', 'renderer_unhandled_rejection')).toEqual({
      error_code: 'renderer_unhandled_rejection',
      error_message: 'rejected with text',
      stack_trace: undefined,
    });
  });
});
