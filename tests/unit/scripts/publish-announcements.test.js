import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { readAnnouncements, buildManifest } from '../../../scripts/publish-announcements.mjs';

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
