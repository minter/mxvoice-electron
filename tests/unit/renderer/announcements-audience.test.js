import { describe, it, expect } from 'vitest';
import { passesAudienceFilter, isExpired } from '../../../src/renderer/modules/announcements/audience.js';

describe('audience filter', () => {
  const ctx = { version: '4.3.0', platform: 'darwin' };
  it('passes when audience is undefined', () => {
    expect(passesAudienceFilter({ id: 'x' }, ctx)).toBe(true);
  });
  it('filters by min_version', () => {
    expect(passesAudienceFilter({ audience: { min_version: '4.2.0' } }, ctx)).toBe(true);
    expect(passesAudienceFilter({ audience: { min_version: '4.4.0' } }, ctx)).toBe(false);
  });
  it('filters by max_version', () => {
    expect(passesAudienceFilter({ audience: { max_version: '4.3.0' } }, ctx)).toBe(true);
    expect(passesAudienceFilter({ audience: { max_version: '4.2.9' } }, ctx)).toBe(false);
  });
  it('filters by platforms array', () => {
    expect(passesAudienceFilter({ audience: { platforms: ['darwin', 'linux'] } }, ctx)).toBe(true);
    expect(passesAudienceFilter({ audience: { platforms: ['win32'] } }, ctx)).toBe(false);
  });
  it('combines version and platform filters with AND', () => {
    expect(passesAudienceFilter({ audience: { min_version: '4.2.0', platforms: ['darwin'] } }, ctx)).toBe(true);
    expect(passesAudienceFilter({ audience: { min_version: '4.2.0', platforms: ['win32'] } }, ctx)).toBe(false);
  });
  it('equal versions pass min_version and max_version filters', () => {
    // 4.3.0 vs min_version 4.3.0 should pass (not strictly less than)
    expect(passesAudienceFilter({ audience: { min_version: '4.3.0' } }, ctx)).toBe(true);
    // 4.3.0 vs max_version 4.3.0 should pass (not strictly greater than)
    expect(passesAudienceFilter({ audience: { max_version: '4.3.0' } }, ctx)).toBe(true);
  });
  it('handles minor and patch version differences', () => {
    // 4.3.0 vs min 4.2.5 → pass (4.3 > 4.2)
    expect(passesAudienceFilter({ audience: { min_version: '4.2.5' } }, ctx)).toBe(true);
    // 4.3.0 vs max 4.2.99 → fail (4.3 > 4.2)
    expect(passesAudienceFilter({ audience: { max_version: '4.2.99' } }, ctx)).toBe(false);
  });
});

describe('isExpired', () => {
  it('returns false when expires is not set', () => {
    expect(isExpired({ id: 'x' }, new Date('2026-06-01'))).toBe(false);
  });
  it('returns true when expires is in the past', () => {
    expect(isExpired({ expires: '2026-01-01T00:00:00Z' }, new Date('2026-06-01'))).toBe(true);
  });
  it('returns false when expires is in the future', () => {
    expect(isExpired({ expires: '2026-12-01T00:00:00Z' }, new Date('2026-06-01'))).toBe(false);
  });
});
