import { describe, expect, it } from 'vitest';
import { describeUpdateError } from '../../../src/main/modules/update-analytics.js';

function error(message, code) {
  const err = new Error(message);
  if (code) err.code = code;
  return err;
}

describe('describeUpdateError', () => {
  it('reports the updater error code without the message', () => {
    const err = error('Cannot find latest.yml in the latest release artifacts (https://…): HttpError: 404', 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND');
    expect(describeUpdateError(err)).toEqual({ error_code: 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND' });
  });

  it('falls back to the HTTP status when there is no code', () => {
    const err = error('HttpError: 503');
    err.statusCode = 503;
    expect(describeUpdateError(err)).toEqual({ error_code: 'HTTP_503' });
  });

  it('labels errors without a code or status as unknown', () => {
    expect(describeUpdateError(error('something odd'))).toEqual({ error_code: 'unknown' });
  });

  it.each([
    'net::ERR_INTERNET_DISCONNECTED',
    'net::ERR_NETWORK_CHANGED',
    'net::ERR_NAME_NOT_RESOLVED',
    'net::ERR_CONNECTION_TIMED_OUT',
    'getaddrinfo ENOTFOUND github.com',
    'connect ETIMEDOUT 140.82.112.3:443',
    'getaddrinfo EAI_AGAIN github.com',
  ])('ignores offline errors: %s', (message) => {
    expect(describeUpdateError(error(message))).toBeNull();
  });

  it('ignores offline errors identified only by code', () => {
    expect(describeUpdateError(error('request failed', 'ENOTFOUND'))).toBeNull();
  });

  it('handles a missing error', () => {
    expect(describeUpdateError(undefined)).toEqual({ error_code: 'unknown' });
  });
});
