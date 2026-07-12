import { beforeEach, describe, expect, it, vi } from 'vitest';

const searchSongs = vi.fn();
const trackEvent = vi.fn();
const isVisible = vi.fn(() => false);
const val = vi.fn(() => '');

vi.mock('../../../src/renderer/modules/adapters/secure-adapter.js', () => ({
  secureDatabase: { searchSongs }, secureAnalytics: { trackEvent }
}));
vi.mock('../../../src/renderer/modules/dom-utils/index.js', () => ({
  default: { isVisible, val }
}));
vi.mock('../../../src/renderer/modules/drag-drop/drag-drop-functions.js', () => ({ songDrag: vi.fn() }));

function node(tag = 'div') {
  return {
    tag, id: '', textContent: '', className: '', style: {}, children: [], removed: false,
    appendChild(child) {
      if (child.tag === 'fragment') this.children.push(...child.children);
      else this.children.push(child);
      return child;
    },
    querySelectorAll() { return this.children.filter((child) => child.tag === 'tr' && !child.removed); },
    remove() { this.removed = true; },
    setAttribute(name, value) { this[name] = value; },
    addEventListener: vi.fn(), select: vi.fn()
  };
}

const tbody = node('tbody');
const thead = node('thead');
const omni = node('input');
const category = node('select');

globalThis.window = { debugLog: { info: vi.fn(), warn: vi.fn() } };
globalThis.document = {
  getElementById(id) {
    if (id === 'omni_search') return omni;
    if (id === 'category_select') return category;
    if (id === 'search-loading-indicator') {
      return tbody.children.find((child) => child.id === id && !child.removed) || null;
    }
    return null;
  },
  querySelector(selector) {
    if (selector.endsWith('tbody')) return tbody;
    if (selector.endsWith('thead')) return thead;
    return null;
  },
  createElement: (tag) => node(tag),
  createTextNode: (text) => ({ textContent: text }),
  createDocumentFragment: () => node('fragment')
};

const sharedState = (await import('../../../src/renderer/modules/shared-state.js')).default;
const searchEngine = await import('../../../src/renderer/modules/search/search-engine.js');

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('search engine orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tbody.children.length = 0;
    omni.value = '';
    category.value = '*';
    thead.style.display = 'none';
    sharedState.set('categories', { MUS: 'Music' });
  });

  it('uses cached category names and falls back to unknown codes', () => {
    expect(searchEngine.getCategoryNameSync('MUS')).toBe('Music');
    expect(searchEngine.getCategoryNameSync('UNK')).toBe('UNK');
    expect(searchEngine.getCategoryNameSync(null)).toBe('');
  });

  it('builds a basic query, renders wrapped results, and tracks intentional searches', async () => {
    omni.value = 'anthem';
    searchSongs.mockResolvedValue({
      success: true,
      data: [{ id: 7, category: 'MUS', title: 'Anthem', artist: 'Band', info: '', time: '3:00' }]
    });
    searchEngine.searchData();
    await flush();

    expect(searchSongs).toHaveBeenCalledWith({
      category: '*', searchTerm: 'anthem', advancedFilters: null
    });
    expect(trackEvent).toHaveBeenCalledWith('search_performed', { result_count: 1 });
    const row = tbody.children.find((child) => child.songid === '7');
    expect(row.children[0].textContent).toBe('Music');
  });

  it('ignores an older result that resolves after a newer search', async () => {
    let resolveFirst;
    searchSongs
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({
        success: true, data: [{ id: 2, category: 'MUS', title: 'New', artist: '', info: '', time: '' }]
      });

    omni.value = 'old';
    searchEngine.searchData();
    omni.value = 'new';
    searchEngine.searchData();
    await flush();
    resolveFirst({
      success: true, data: [{ id: 1, category: 'MUS', title: 'Old', artist: '', info: '', time: '' }]
    });
    await flush();

    expect(tbody.children.some((child) => child.songid === '2')).toBe(true);
    expect(tbody.children.some((child) => child.songid === '1')).toBe(false);
  });

  it('removes the loading state after a rejected database call', async () => {
    searchSongs.mockRejectedValue(new Error('database offline'));
    searchEngine.searchData();
    await flush();
    expect(document.getElementById('search-loading-indicator')).toBeNull();
    expect(window.debugLog.warn).toHaveBeenCalledWith(
      '❌ Database API error:', expect.objectContaining({ error: 'database offline' })
    );
  });
});
