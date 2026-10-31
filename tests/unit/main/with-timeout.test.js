import { describe, expect, it, vi } from 'vitest';
import { withTimeout, TimeoutError } from '../../../src/main/modules/with-timeout.js';

describe('withTimeout', () => {
  it('passes through a result that arrives in time and leaves no timer behind', async () => {
    vi.useFakeTimers();
    try {
      await expect(withTimeout(Promise.resolve(7), 100, 'slow')).resolves.toBe(7);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects with a TimeoutError carrying the message when the timer wins', async () => {
    vi.useFakeTimers();
    try {
      const raced = withTimeout(new Promise(() => {}), 100, 'flush timed out');
      vi.advanceTimersByTime(100);
      await expect(raced).rejects.toBeInstanceOf(TimeoutError);
      await expect(raced).rejects.toThrow('flush timed out');
    } finally {
      vi.useRealTimers();
    }
  });

  it('passes through the promise\'s own rejection', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 100, 'slow')).rejects.toThrow('boom');
  });
});
