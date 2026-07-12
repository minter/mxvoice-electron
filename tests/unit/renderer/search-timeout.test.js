import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import sharedState from '../../../src/renderer/modules/shared-state.js';
import {
  clearSearchTimeout,
  scheduleSearch
} from '../../../src/renderer/modules/search/search-timeout.js';

describe('search timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sharedState.set('searchTimeout', null);
  });

  afterEach(() => {
    clearSearchTimeout();
    vi.useRealTimers();
  });

  it('replaces a pending search and runs only the latest callback', () => {
    const first = vi.fn();
    const second = vi.fn();

    scheduleSearch(first);
    scheduleSearch(second);
    vi.advanceTimersByTime(300);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    expect(sharedState.get('searchTimeout')).toBe(null);
  });

  it('cancels a pending search', () => {
    const callback = vi.fn();

    scheduleSearch(callback);
    clearSearchTimeout();
    vi.advanceTimersByTime(300);

    expect(callback).not.toHaveBeenCalled();
    expect(sharedState.get('searchTimeout')).toBe(null);
  });
});
