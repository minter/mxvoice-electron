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

  it('reports Error instances with message and stack', () => {
    const error = new Error('boom');
    expect(buildRendererErrorReport(error)).toEqual({ error_message: 'boom', stack_trace: error.stack });
  });

  it('reports non-Error rejection reasons as strings', () => {
    expect(buildRendererErrorReport('plain failure')).toEqual({ error_message: 'plain failure', stack_trace: undefined });
  });

  it('prefers the event message when the error object is missing', () => {
    expect(buildRendererErrorReport(undefined, 'Script error.')).toEqual({ error_message: 'Script error.', stack_trace: undefined });
  });
});
