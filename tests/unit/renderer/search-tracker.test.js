import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SEARCH_SETTLE_MS,
  flushPendingSearch,
  recordSearch,
  resetSearchTracker,
} from '../../../src/renderer/modules/analytics/search-tracker.js';

const trackEvent = vi.fn();

describe('search tracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    trackEvent.mockClear();
    globalThis.window = { secureElectronAPI: { analytics: { trackEvent } } };
    resetSearchTracker();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a search once the query settles', () => {
    recordSearch({ signature: 'abc', resultCount: 4, source: 'live' });
    expect(trackEvent).not.toHaveBeenCalled();

    vi.advanceTimersByTime(SEARCH_SETTLE_MS);

    expect(trackEvent).toHaveBeenCalledWith('search_performed', { result_count: 4, source: 'live' });
  });

  it('only sends the final query while the user is still typing', () => {
    recordSearch({ signature: 'ab', resultCount: 0, source: 'live' });
    vi.advanceTimersByTime(SEARCH_SETTLE_MS - 1);
    recordSearch({ signature: 'abc', resultCount: 3, source: 'live' });
    vi.advanceTimersByTime(SEARCH_SETTLE_MS);

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('search_performed', { result_count: 3, source: 'live' });
  });

  it('does not re-send the same query submitted right after it was tracked', () => {
    recordSearch({ signature: 'abc', resultCount: 3, source: 'live' });
    vi.advanceTimersByTime(SEARCH_SETTLE_MS);
    recordSearch({ signature: 'abc', resultCount: 3, source: 'submit' });
    vi.advanceTimersByTime(SEARCH_SETTLE_MS);

    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('sends a repeated query again once the dedupe window has passed', () => {
    recordSearch({ signature: 'abc', resultCount: 3, source: 'live' });
    vi.advanceTimersByTime(SEARCH_SETTLE_MS);
    vi.advanceTimersByTime(60_000);
    recordSearch({ signature: 'abc', resultCount: 3, source: 'live' });
    vi.advanceTimersByTime(SEARCH_SETTLE_MS);

    expect(trackEvent).toHaveBeenCalledTimes(2);
  });

  it('flushes a pending search immediately on demand', () => {
    recordSearch({ signature: 'abc', resultCount: 3, source: 'live' });

    flushPendingSearch();

    expect(trackEvent).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(SEARCH_SETTLE_MS);
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('does nothing when flushing with no pending search', () => {
    flushPendingSearch();
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
