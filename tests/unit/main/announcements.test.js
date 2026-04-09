import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockDebugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

let storeData = {};
const mockStore = {
  get: vi.fn(key => storeData[key]),
  set: vi.fn((key, value) => { storeData[key] = value; }),
};

const { createAnnouncements } = await import('../../../src/main/modules/announcements.js');

describe('announcements module - fetchManifest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeData = {};
    globalThis.fetch = vi.fn();
  });

  it('fetches and caches the manifest on success', async () => {
    const manifest = { schema_version: 1, generated_at: '2026-04-09T00:00:00Z', announcements: [] };
    globalThis.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => manifest });
    const ann = createAnnouncements({ store: mockStore, debugLog: mockDebugLog, manifestUrl: 'https://example.com/m.json' });
    const result = await ann.fetchManifest();
    expect(result).toEqual(manifest);
    expect(mockStore.set).toHaveBeenCalledWith('announcements_manifest_cache', manifest);
  });

  it('returns cache when network fails', async () => {
    const cached = { schema_version: 1, announcements: [{ id: 'cached', title: 'C', severity: 'info', published: '2026-04-01T00:00:00Z', path: 'p' }] };
    storeData.announcements_manifest_cache = cached;
    globalThis.fetch.mockRejectedValue(new Error('network down'));
    const ann = createAnnouncements({ store: mockStore, debugLog: mockDebugLog, manifestUrl: 'https://example.com/m.json' });
    const result = await ann.fetchManifest();
    expect(result).toEqual(cached);
    expect(mockDebugLog.warn).toHaveBeenCalled();
  });

  it('ignores manifest with unknown schema_version', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ schema_version: 99, announcements: [] }) });
    const cached = { schema_version: 1, announcements: [] };
    storeData.announcements_manifest_cache = cached;
    const ann = createAnnouncements({ store: mockStore, debugLog: mockDebugLog, manifestUrl: 'https://example.com/m.json' });
    const result = await ann.fetchManifest();
    expect(result).toEqual(cached);
  });

  it('returns null when no cache and network fails', async () => {
    globalThis.fetch.mockRejectedValue(new Error('down'));
    const ann = createAnnouncements({ store: mockStore, debugLog: mockDebugLog, manifestUrl: 'https://example.com/m.json' });
    expect(await ann.fetchManifest()).toBeNull();
  });
});
