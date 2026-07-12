import { describe, expect, it, vi } from 'vitest';
const clearSearchTimeout = vi.fn();
vi.mock('../../../src/renderer/modules/search/search-timeout.js', () => ({ clearSearchTimeout }));
const classes = new Set(['fa-plus']);
const nodes = {
  search_form: { reset: vi.fn() },
  'advanced-search': { offsetParent: null, style: { display: 'none' } },
  advanced_search_button: { classList: { contains: (x) => classes.has(x), add: (x) => classes.add(x), remove: (x) => classes.delete(x) } },
  'title-search': { style: {}, focus: vi.fn() }, omni_search: { style: {}, focus: vi.fn() }
};
const rows = [{ remove: vi.fn() }];
globalThis.window = { debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } };
globalThis.document = { getElementById: (id) => nodes[id] || null, querySelector: (s) => s.endsWith('tbody') ? { querySelectorAll: () => rows } : { style: {} } };
const { performAdvancedSearch } = await import('../../../src/renderer/modules/search/advanced-search.js');
describe('advanced search toggle', () => {
  it('clears prior search state and opens the advanced form', async () => {
    await performAdvancedSearch({});
    expect(clearSearchTimeout).toHaveBeenCalled(); expect(nodes.search_form.reset).toHaveBeenCalled(); expect(rows[0].remove).toHaveBeenCalled();
    expect(nodes['advanced-search'].style.display).toBe(''); expect(classes.has('fa-minus')).toBe(true); expect(nodes.omni_search.style.display).toBe('none');
  });
});
