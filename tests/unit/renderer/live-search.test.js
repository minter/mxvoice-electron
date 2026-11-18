import { beforeEach, describe, expect, it, vi } from 'vitest';

const searchSongs = vi.fn();
vi.mock('../../../src/renderer/modules/adapters/secure-adapter.js', () => ({ secureDatabase: { searchSongs } }));
vi.mock('../../../src/renderer/modules/drag-drop/drag-drop-functions.js', () => ({ songDrag: vi.fn() }));
const recordSearch = vi.fn();
vi.mock('../../../src/renderer/modules/analytics/search-tracker.js', () => ({ recordSearch }));

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
const appendPlayedPill = vi.fn();
vi.mock('../../../src/renderer/modules/shows/played-pills.js', () => ({ appendPlayedPill }));
const live = await import('../../../src/renderer/modules/search/live-search.js');

describe('live search', () => {
  beforeEach(() => { vi.clearAllMocks(); tbody.children.length = 0; category.value = '*'; advanced.offsetParent = null; sharedState.set('categories', { MUS: 'Music' }); });
  it('builds a basic query and renders successful results', async () => {
    searchSongs.mockResolvedValue({ success: true, data: [{ id: 1, category: 'MUS', title: 'Song', artist: 'A', info: '', time: '01:00' }] });
    await live.performLiveSearch('so');
    expect(searchSongs).toHaveBeenCalledWith({ category: '*', searchTerm: 'so', advancedFilters: null });
    // Category is a tag in its cell; the title is a span that clamps, with the full title as a tooltip
    const [categoryCell, , titleCell] = tbody.children[0].children;
    expect(categoryCell.children[0]).toMatchObject({ className: 'category-tag', textContent: 'Music' });
    expect(titleCell.className).toBe('song-title-cell');
    expect(titleCell.children[0].className).toBe('song-title-text');
    // One time format everywhere
    expect(tbody.children[0].children[4]).toMatchObject({ className: 'song-time-cell', textContent: '1:00' });
    expect(tbody.children[0].children).toHaveLength(5);
    expect(appendPlayedPill).toHaveBeenCalledWith(tbody.children[0].children[2], 1);
    expect(recordSearch).toHaveBeenCalledWith({
      signature: JSON.stringify({ category: '*', searchTerm: 'so', advancedFilters: null }),
      resultCount: 1,
      source: 'live',
    });
  });
  it('does not record a failed search', async () => {
    searchSongs.mockResolvedValueOnce({ success: false, error: 'bad query' });
    await live.performLiveSearch('so');
    expect(recordSearch).not.toHaveBeenCalled();
  });
  it('handles wrapped failures and rejected calls without throwing', async () => {
    searchSongs.mockResolvedValueOnce({ success: false, error: 'bad query' });
    await expect(live.performLiveSearch('so')).resolves.toBeUndefined();
    searchSongs.mockRejectedValueOnce(new Error('offline'));
    await expect(live.performLiveSearch('so')).resolves.toBeUndefined();
    expect(window.debugLog.warn).toHaveBeenCalled();
  });
});
