/**
 * Race a promise against a timer. The timer is always cleared, so a settled
 * promise leaves nothing pending.
 *
 * @module with-timeout
 */

export class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * @param {Promise} promise
 * @param {number} ms
 * @param {string} message - TimeoutError message when the timer wins
 * @returns {Promise} the promise's result, or a TimeoutError rejection
 */
export function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(message)), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}

export default withTimeout;
