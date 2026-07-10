import { describe, expect, it } from 'vitest';
import { isAllowedAboutExternalUrl } from '../../../src/main/modules/about-external-url.js';

describe('About window external URL validation', () => {
  it.each([
    'https://mxvoice.app/',
    'https://mxvoice.app/docs/',
    'mailto:support@mxvoice.app?subject=Mx.%20Voice%20Support%20Request'
  ])('allows the expected destination: %s', url => {
    expect(isAllowedAboutExternalUrl(url)).toBe(true);
  });

  it.each([
    'https://evil.example/',
    'https://mxvoice.app.evil.example/',
    'https://mxvoice.app/other',
    'mailto:attacker@example.com',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'not a URL',
    '',
    null
  ])('rejects an unapproved destination: %s', url => {
    expect(isAllowedAboutExternalUrl(url)).toBe(false);
  });
});
