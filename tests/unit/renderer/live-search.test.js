import { beforeEach, describe, expect, it, vi } from 'vitest';

const searchSongs = vi.fn();
vi.mock('../../../src/renderer/modules/adapters/secure-adapter.js', () => ({ secureDatabase: { searchSongs } }));
vi.mock('../../../src/renderer/modules/drag-drop/drag-drop-functions.js', () => ({ songDrag: vi.fn() }));

function node(tag = 'div') { return { tag, value: '', offsetParent: null, style: {}, children: [], appendChild(c) { if (c.tag === 'fragment') this.children.push(...c.children); else this.children.push(c); }, querySelectorAll() { return []; }, setAttribute(k,v){this[k]=v;}, addEventListener: vi.fn() }; }
const tbody = node('tbody'); const thead = node('thead'); const category = node('select'); const advanced = node();
globalThis.window = { debugLog: { info: vi.fn(), warn: vi.fn() } };
globalThis.scaleScrollable = vi.fn();
globalThis.document = {
  querySelector: (s) => s.endsWith('tbody') ? tbody : thead,
  getElementById: (id) => id === 'category_select' ? category : id === 'advanced-search' ? advanced : null,
  createElement: (tag) => node(tag), createDocumentFragment: () => node('fragment')
};
const sharedState = (await import('../../../src/renderer/modules/shared-state.js')).default;
const live = await import('../../../src/renderer/modules/search/live-search.js');

describe('live search', () => {
  beforeEach(() => { vi.clearAllMocks(); tbody.children.length = 0; category.value = '*'; advanced.offsetParent = null; sharedState.set('categories', { MUS: 'Music' }); });
  it('builds a basic query and renders successful results', async () => {
    searchSongs.mockResolvedValue({ success: true, data: [{ id: 1, category: 'MUS', title: 'Song', artist: 'A', info: '', time: '1:00' }] });
    await live.performLiveSearch('so');
    expect(searchSongs).toHaveBeenCalledWith({ category: '*', searchTerm: 'so', advancedFilters: null });
    expect(tbody.children[0].children[0].textContent).toBe('Music');
  });
  it('handles wrapped failures and rejected calls without throwing', async () => {
    searchSongs.mockResolvedValueOnce({ success: false, error: 'bad query' });
    await expect(live.performLiveSearch('so')).resolves.toBeUndefined();
    searchSongs.mockRejectedValueOnce(new Error('offline'));
    await expect(live.performLiveSearch('so')).resolves.toBeUndefined();
    expect(window.debugLog.warn).toHaveBeenCalled();
  });
});
