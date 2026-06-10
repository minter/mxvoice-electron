import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import { readAnnouncements, validateAnnouncements, buildManifest } from '../../../scripts/publish-announcements.mjs';
import { loadSentLedger, isAlreadySent, appendSent, saveSentLedger } from '../../../scripts/publish-announcements.mjs';
import { renderEmail } from '../../../scripts/publish-announcements.mjs';
import { resolveMailgunConfig, sendToMailgun } from '../../../scripts/publish-announcements.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../../fixtures/announcements');

describe('publish-announcements script', () => {
  describe('readAnnouncements', () => {
    it('reads markdown files and parses frontmatter', () => {
      const items = readAnnouncements(fixturesDir);
      expect(items).toHaveLength(2);
      const first = items.find(a => a.id === '2026-01-01-first');
      expect(first.title).toBe('First announcement');
      expect(first.severity).toBe('info');
      expect(first.email).toBe(false);
      expect(first.body).toContain('Body of first.');
    });

    it('uses explicit id from frontmatter when present', () => {
      const items = readAnnouncements(fixturesDir);
      const second = items.find(a => a.id === 'custom-id');
      expect(second).toBeDefined();
      expect(second.title).toBe('Second announcement');
    });

    it('defaults id to filename stem when not in frontmatter', () => {
      const items = readAnnouncements(fixturesDir);
      const first = items.find(a => a.id === '2026-01-01-first');
      expect(first).toBeDefined();
    });

    it('throws on duplicate announcement ids', () => {
      expect(() => validateAnnouncements([
        { id: 'dup', path: 'announcements/one.md' },
        { id: 'dup', path: 'announcements/two.md' },
      ])).toThrow(/Duplicate announcement id "dup"/);
    });
  });

  describe('buildManifest', () => {
    it('produces schema version 1 and sorts by published descending', () => {
      const items = readAnnouncements(fixturesDir);
      const manifest = buildManifest(items);
      expect(manifest.schema_version).toBe(1);
      expect(manifest.announcements).toHaveLength(2);
      expect(manifest.announcements[0].id).toBe('custom-id');
      expect(manifest.announcements[1].id).toBe('2026-01-01-first');
    });

    it('excludes body from manifest entries', () => {
      const items = readAnnouncements(fixturesDir);
      const manifest = buildManifest(items);
      expect(manifest.announcements[0].body).toBeUndefined();
    });

    it('includes audience and path in manifest entries', () => {
      const items = readAnnouncements(fixturesDir);
      const manifest = buildManifest(items);
      const second = manifest.announcements.find(a => a.id === 'custom-id');
      expect(second.audience.min_version).toBe('4.0.0');
      expect(second.path).toBe('announcements/2026-02-01-second.md');
    });
  });
});

describe('sent ledger', () => {
  let tmpPath;
  beforeEach(() => { tmpPath = path.join(os.tmpdir(), `sent-${Date.now()}.json`); });
  afterEach(() => { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); });

  it('returns empty sent list if file does not exist', () => {
    expect(loadSentLedger(tmpPath).sent).toEqual([]);
  });

  it('loads existing sent ledger from file', () => {
    fs.writeFileSync(tmpPath, JSON.stringify({ sent: [{ id: 'a', sent_at: '2026-01-01T00:00:00Z' }] }));
    const ledger = loadSentLedger(tmpPath);
    expect(ledger.sent).toHaveLength(1);
  });

  it('isAlreadySent returns true for known ids', () => {
    const ledger = { sent: [{ id: 'a' }] };
    expect(isAlreadySent(ledger, 'a')).toBe(true);
    expect(isAlreadySent(ledger, 'b')).toBe(false);
  });

  it('appendSent adds an entry with timestamp', () => {
    const ledger = { sent: [] };
    appendSent(ledger, 'new-id');
    expect(ledger.sent).toHaveLength(1);
    expect(ledger.sent[0].id).toBe('new-id');
    expect(ledger.sent[0].sent_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('saveSentLedger writes the ledger to disk', () => {
    const ledger = { sent: [{ id: 'z', sent_at: '2026-01-01T00:00:00Z' }] };
    saveSentLedger(tmpPath, ledger);
    const reloaded = JSON.parse(fs.readFileSync(tmpPath, 'utf8'));
    expect(reloaded.sent[0].id).toBe('z');
  });
});

describe('email rendering', () => {
  it('wraps rendered markdown body in the template', () => {
    const item = { id: 'test', title: 'Test Title', body: 'Hello **world**.' };
    const { subject, html, text } = renderEmail(item);
    expect(subject).toBe('Test Title');
    expect(html).toContain('<strong>world</strong>');
    expect(html).toContain('Test Title');
    expect(html).toContain('%unsubscribe_url%');
    expect(text).toContain('Hello');
    expect(text).toContain('world');
  });

  it('text version strips tags', () => {
    const item = { id: 't', title: 'T', body: '# Heading\n\nParagraph.' };
    const { text } = renderEmail(item);
    expect(text).not.toContain('<');
    expect(text).toContain('Heading');
  });
});

describe('resolveMailgunConfig', () => {
  it('defaults to sandbox mode', () => {
    expect(resolveMailgunConfig({}).mode).toBe('sandbox');
  });
  it('uses production when MAILGUN_MODE=production', () => {
    expect(resolveMailgunConfig({ MAILGUN_MODE: 'production' }).mode).toBe('production');
  });
  it('uses sandbox when MAILGUN_MODE=sandbox', () => {
    expect(resolveMailgunConfig({ MAILGUN_MODE: 'sandbox' }).mode).toBe('sandbox');
  });
});

describe('sendToMailgun', () => {
  let fetchMock;
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '{}' });
    globalThis.fetch = fetchMock;
  });
  afterEach(() => { delete globalThis.fetch; });

  const baseConfig = {
    apiKey: 'key-abc',
    sandboxDomain: 'sandbox-xyz.mailgun.org',
    sandboxListAddress: 'test@sandbox-xyz.mailgun.org',
    productionDomain: 'mg.example.com',
    productionListAddress: 'list@mg.example.com',
    fromAddress: 'Mx. Voice <a@mg.example.com>',
  };

  it('sends to sandbox domain in sandbox mode', async () => {
    const result = await sendToMailgun({ ...baseConfig, mode: 'sandbox' }, { subject: 'S', html: '<p>H</p>', text: 'T' });
    expect(result.ok).toBe(true);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('sandbox-xyz.mailgun.org');
    expect(options.headers.Authorization).toMatch(/^Basic /);
  });

  it('sends to production domain in production mode', async () => {
    await sendToMailgun({ ...baseConfig, mode: 'production' }, { subject: 'S', html: '<p>H</p>', text: 'T' });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('mg.example.com');
    expect(url).not.toContain('sandbox');
  });
});
