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

describe('announcements module - fetchBody', () => {
  beforeEach(() => {
    storeData = {};
    globalThis.fetch = vi.fn();
  });

  it('fetches and caches an announcement body', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, status: 200, text: async () => '---\ntitle: T\n---\nBody.' });
    const ann = createAnnouncements({
      store: mockStore, debugLog: mockDebugLog,
      manifestUrl: 'https://example.com/m.json', bodyUrlBase: 'https://example.com/',
    });
    const body = await ann.fetchBody('announcements/test.md');
    expect(body).toContain('Body.');
    expect(globalThis.fetch).toHaveBeenCalledWith('https://example.com/announcements/test.md', expect.any(Object));
  });

  it('returns cached body without network call on second fetch', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, status: 200, text: async () => 'body' });
    const ann = createAnnouncements({
      store: mockStore, debugLog: mockDebugLog,
      manifestUrl: 'https://example.com/m.json', bodyUrlBase: 'https://example.com/',
    });
    await ann.fetchBody('announcements/x.md');
    globalThis.fetch.mockClear();
    const second = await ann.fetchBody('announcements/x.md');
    expect(second).toBe('body');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe('announcements module - subscribeEmail', () => {
  beforeEach(() => {
    storeData = {};
    globalThis.fetch = vi.fn();
  });

  const mailgun = { apiKey: 'key-abc', domain: 'mg.example.com', listAddress: 'list@mg.example.com' };

  it('returns ok with code "subscribed" on 200', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, status: 200, text: async () => '{}' });
    const ann = createAnnouncements({ store: mockStore, debugLog: mockDebugLog, manifestUrl: 'https://example.com/m.json', mailgun });
    const result = await ann.subscribeEmail('a@b.com', {});
    expect(result.ok).toBe(true);
    expect(result.code).toBe('subscribed');
  });

  it('treats 400 "already exists" as ok with code "already_subscribed"', async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 400, text: async () => '{"message":"Address already exists"}' });
    const ann = createAnnouncements({ store: mockStore, debugLog: mockDebugLog, manifestUrl: 'https://example.com/m.json', mailgun });
    const result = await ann.subscribeEmail('a@b.com', {});
    expect(result.ok).toBe(true);
    expect(result.code).toBe('already_subscribed');
  });

  it('returns ok=false code "network_error" on fetch rejection', async () => {
    globalThis.fetch.mockRejectedValue(new Error('offline'));
    const ann = createAnnouncements({ store: mockStore, debugLog: mockDebugLog, manifestUrl: 'https://example.com/m.json', mailgun });
    const result = await ann.subscribeEmail('a@b.com', {});
    expect(result.ok).toBe(false);
    expect(result.code).toBe('network_error');
  });

  it('returns ok=false code "not_configured" when mailgun missing', async () => {
    const ann = createAnnouncements({ store: mockStore, debugLog: mockDebugLog, manifestUrl: 'https://example.com/m.json' });
    const result = await ann.subscribeEmail('a@b.com', {});
    expect(result.ok).toBe(false);
    expect(result.code).toBe('not_configured');
  });
});
