import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  default: { dialog: {}, app: { getPath: vi.fn() } }
}));
vi.mock('music-metadata', () => ({ parseFile: vi.fn() }));

let parseHotkeyFileLines;
beforeAll(async () => {
  ({ parseHotkeyFileLines } = await import('../../../src/main/modules/file-operations.js'));
});

describe('hotkey file parsing', () => {
  it('parses the documented keys and tab name', () => {
    const result = parseHotkeyFileLines(['f1::1001', 'F12::', 'tab_name::Friday_Night']);
    expect(result).toEqual({
      hotkeys: { f1: '1001', f12: '' },
      title: 'Friday Night',
      errors: []
    });
  });

  it('ignores blank lines', () => {
    expect(parseHotkeyFileLines(['', '   ', 'f2::42']).errors).toEqual([]);
  });

  it('reports missing separators without throwing', () => {
    const result = parseHotkeyFileLines(['broken line']);
    expect(result.errors).toEqual(['Line 1: missing :: separator']);
  });

  it('rejects unknown keys and out-of-range function keys', () => {
    const result = parseHotkeyFileLines(['f13::1', 'title::Show']);
    expect(result.errors).toHaveLength(2);
  });

  it('rejects non-numeric song IDs', () => {
    const result = parseHotkeyFileLines(['f4::not-a-song']);
    expect(result.errors).toEqual(['Line 1: invalid song ID for f4']);
  });
});
