import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../../../src/renderer/modules/dom-utils/escape-html.js';

describe('escapeHtml', () => {
  it('escapes markup and both quote styles', () => {
    expect(escapeHtml(`<img src=x onerror="a('b')">&`)).toBe('&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
  });

  it('handles empty, missing and non-string values', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(0)).toBe('0');
  });
});
