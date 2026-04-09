import { describe, it, expect, beforeEach, vi } from 'vitest';

let prefs = {};
globalThis.window = {
  secureElectronAPI: {
    profile: {
      getPreference: vi.fn(async key => ({ success: true, value: prefs[key] })),
      setPreference: vi.fn(async (key, value) => { prefs[key] = value; return { success: true }; }),
    },
  },
};

const { createSeenTracking } = await import('../../../src/renderer/modules/announcements/seen-tracking.js');

describe('announcements seen tracking', () => {
  beforeEach(() => { prefs = {}; vi.clearAllMocks(); });

  it('returns empty array when no preference is set', async () => {
    expect(await createSeenTracking().getSeen()).toEqual([]);
  });

  it('markSeen adds an id and persists', async () => {
    const t = createSeenTracking();
    await t.markSeen('a');
    await t.markSeen('b');
    expect(prefs.announcements_seen).toEqual(['a', 'b']);
  });

  it('markSeen is idempotent', async () => {
    const t = createSeenTracking();
    await t.markSeen('a');
    await t.markSeen('a');
    expect(prefs.announcements_seen).toEqual(['a']);
  });

  it('isSeen returns true for marked ids', async () => {
    const t = createSeenTracking();
    await t.markSeen('a');
    expect(await t.isSeen('a')).toBe(true);
    expect(await t.isSeen('b')).toBe(false);
  });
});
