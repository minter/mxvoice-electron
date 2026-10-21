import { describe, expect, it, vi } from 'vitest';

globalThis.window = globalThis.window || {};
window.debugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const { applyShowColor, SHOW_COLORS } = await import('../../../src/renderer/modules/shows/show-color.js');

const fakeDoc = () => ({ documentElement: { dataset: {} } });

describe('applyShowColor', () => {
  it('lists the same palette as the show document', async () => {
    const main = await import('../../../src/main/modules/show-document.js');
    expect(SHOW_COLORS).toEqual(main.SHOW_COLORS);
  });

  it('sets data-show-color on <html> for each palette key', () => {
    const doc = fakeDoc();
    for (const key of SHOW_COLORS) {
      applyShowColor(key, doc);
      expect(doc.documentElement.dataset.showColor).toBe(key);
    }
  });

  it('removes the attribute for null and for a key it does not know', () => {
    for (const value of [null, undefined, 'mauve', 'Teal', 7, '__proto__']) {
      const doc = fakeDoc();
      applyShowColor('teal', doc);
      applyShowColor(value, doc);
      expect('showColor' in doc.documentElement.dataset, String(value)).toBe(false);
    }
  });

  it('never throws without a document element', () => {
    expect(() => applyShowColor('teal', {})).not.toThrow();
    expect(() => applyShowColor('teal', null)).not.toThrow();
  });
});
