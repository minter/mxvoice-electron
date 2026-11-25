import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

// The main window and launcher run with script-src 'self'. That is the second
// control behind every escaping fix: an injected inline handler or script is
// refused. These tests keep the policy from being quietly loosened, and keep
// the pages free of the inline script it would block.

const read = (rel) => fs.readFileSync(new URL(`../../../src/${rel}`, import.meta.url), 'utf8');

function directives(html) {
  const meta = html.match(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]+content="([^"]*)"/i);
  expect(meta, 'page has a Content-Security-Policy meta tag').not.toBeNull();
  return Object.fromEntries(
    meta[1].split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
      const [name, ...sources] = d.split(/\s+/);
      return [name, sources];
    })
  );
}

describe.each(['index.html', 'launcher.html'])('%s content security policy', (page) => {
  const html = read(page);

  it('allows only same-origin scripts', () => {
    const { 'script-src': scriptSrc } = directives(html);
    expect(scriptSrc).toEqual(["'self'"]);
  });

  it('does not fall back to a looser default', () => {
    const { 'default-src': defaultSrc } = directives(html);
    expect(defaultSrc).toEqual(["'self'"]);
  });

  it('has no inline script blocks, which the policy would refuse', () => {
    expect(html.match(/<script(?![^>]*\bsrc=)[^>]*>/gi) ?? []).toEqual([]);
  });

  it('has no inline event-handler attributes, which the policy would refuse', () => {
    expect(html.match(/\son[a-z]+\s*=/gi) ?? []).toEqual([]);
  });

  it('has no javascript: URLs', () => {
    expect(html).not.toMatch(/javascript:/i);
  });
});
