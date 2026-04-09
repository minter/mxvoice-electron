#!/usr/bin/env node
/**
 * Publish announcements: regenerate manifest.json, send new email-flagged
 * announcements via Mailgun, update sent.json.
 */
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export function readAnnouncements(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  return files.map(filename => {
    const filePath = path.join(dir, filename);
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(raw);
    const stem = filename.replace(/\.md$/, '');
    return {
      id: parsed.data.id || stem,
      title: parsed.data.title,
      published: parsed.data.published,
      expires: parsed.data.expires,
      severity: parsed.data.severity,
      audience: parsed.data.audience,
      email: parsed.data.email === true,
      body: parsed.content.trim(),
      path: `announcements/${filename}`,
    };
  });
}

export function buildManifest(items) {
  const sorted = [...items].sort((a, b) =>
    new Date(b.published).getTime() - new Date(a.published).getTime()
  );
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    announcements: sorted.map(item => {
      const entry = {
        id: item.id,
        title: item.title,
        published: item.published,
        severity: item.severity,
        path: item.path,
      };
      if (item.expires) entry.expires = item.expires;
      if (item.audience) entry.audience = item.audience;
      return entry;
    }),
  };
}
