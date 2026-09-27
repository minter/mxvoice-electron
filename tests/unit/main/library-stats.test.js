import { describe, it, expect, vi } from 'vitest';
import { collectLibraryStats } from '../../../src/main/modules/library-stats.js';

describe('collectLibraryStats', () => {
  it('reads song and category counts with get()', () => {
    const db = {
      get: vi.fn((sql) => (sql.includes('mrvoice') ? { count: 1234 } : { count: 17 })),
    };

    expect(collectLibraryStats(db)).toEqual({ song_count: 1234, category_count: 17 });
  });

  it('converts BigInt counts to numbers', () => {
    const db = { get: vi.fn(() => ({ count: 42n })) };

    expect(collectLibraryStats(db)).toEqual({ song_count: 42, category_count: 42 });
  });

  it('returns zero when a query yields no row', () => {
    const db = { get: vi.fn(() => undefined) };

    expect(collectLibraryStats(db)).toEqual({ song_count: 0, category_count: 0 });
  });
});
