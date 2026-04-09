import { describe, it, expect } from 'vitest';

// We can't import song-crud.js directly (it has DOM/module dependencies),
// so we replicate the pure functions here for testing.
// These must stay in sync with the implementations in song-crud.js.

/**
 * Parse a MM:SS string into total seconds. Returns null if empty/invalid.
 */
function parseMMSS(mmss) {
  if (!mmss || !mmss.trim()) return null;
  const val = mmss.trim();
  // Handle bare number (seconds only) as fallback
  if (/^\d+$/.test(val)) return parseInt(val, 10);
  // Handle MM:SS format
  const parts = val.split(':');
  if (parts.length !== 2) return null;
  const minutes = parseInt(parts[0], 10);
  const seconds = parseInt(parts[1], 10);
  if (isNaN(minutes) || isNaN(seconds) || minutes < 0 || seconds < 0 || seconds > 59) return null;
  return minutes * 60 + seconds;
}

/**
 * Format seconds into MM:SS string. Returns empty string if null/undefined.
 */
function formatMMSS(totalSeconds) {
  if (totalSeconds == null) return '';
  const secs = Math.round(totalSeconds);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

describe('parseMMSS', () => {
  it('returns null for empty input', () => {
    expect(parseMMSS('')).toBe(null);
    expect(parseMMSS(null)).toBe(null);
    expect(parseMMSS(undefined)).toBe(null);
    expect(parseMMSS('   ')).toBe(null);
  });

  it('parses standard MM:SS format', () => {
    expect(parseMMSS('0:00')).toBe(0);
    expect(parseMMSS('0:45')).toBe(45);
    expect(parseMMSS('1:00')).toBe(60);
    expect(parseMMSS('1:30')).toBe(90);
    expect(parseMMSS('3:23')).toBe(203);
    expect(parseMMSS('10:05')).toBe(605);
  });

  it('handles bare numbers as seconds', () => {
    expect(parseMMSS('45')).toBe(45);
    expect(parseMMSS('0')).toBe(0);
    expect(parseMMSS('120')).toBe(120);
  });

  it('handles whitespace', () => {
    expect(parseMMSS('  1:30  ')).toBe(90);
    expect(parseMMSS(' 45 ')).toBe(45);
  });

  it('rejects invalid formats', () => {
    expect(parseMMSS('abc')).toBe(null);
    expect(parseMMSS('1:60')).toBe(null);  // seconds > 59
    expect(parseMMSS('1:2:3')).toBe(null); // too many colons
    expect(parseMMSS(':30')).toBe(null);   // empty minutes
    expect(parseMMSS('1:')).toBe(null);    // empty seconds
  });

  it('rejects negative values', () => {
    expect(parseMMSS('-1:30')).toBe(null);
    expect(parseMMSS('1:-5')).toBe(null);
  });
});

describe('formatMMSS', () => {
  it('returns empty string for null/undefined', () => {
    expect(formatMMSS(null)).toBe('');
    expect(formatMMSS(undefined)).toBe('');
  });

  it('formats zero', () => {
    expect(formatMMSS(0)).toBe('0:00');
  });

  it('formats seconds under a minute', () => {
    expect(formatMMSS(5)).toBe('0:05');
    expect(formatMMSS(45)).toBe('0:45');
  });

  it('formats minutes and seconds', () => {
    expect(formatMMSS(60)).toBe('1:00');
    expect(formatMMSS(90)).toBe('1:30');
    expect(formatMMSS(203)).toBe('3:23');
    expect(formatMMSS(605)).toBe('10:05');
  });

  it('rounds fractional seconds', () => {
    expect(formatMMSS(90.4)).toBe('1:30');
    expect(formatMMSS(90.6)).toBe('1:31');
  });

  it('pads seconds to two digits', () => {
    expect(formatMMSS(61)).toBe('1:01');
    expect(formatMMSS(3)).toBe('0:03');
  });

  it('roundtrips with parseMMSS', () => {
    const values = [0, 5, 45, 60, 90, 203, 605];
    for (const v of values) {
      expect(parseMMSS(formatMMSS(v))).toBe(v);
    }
  });
});
