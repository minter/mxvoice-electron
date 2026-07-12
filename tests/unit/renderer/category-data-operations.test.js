import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = { getCategories: vi.fn(), getCategoryByCode: vi.fn(), updateCategory: vi.fn(), addCategory: vi.fn(), reassignSongCategory: vi.fn(), deleteCategory: vi.fn(), findCategoryCodesLike: vi.fn() };
vi.mock('../../../src/renderer/modules/adapters/secure-adapter.js', () => ({ secureDatabase: db }));
globalThis.window = { debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } };
globalThis.document = { createElement: () => ({ value: '', textContent: '', selected: false }) };
const sharedState = (await import('../../../src/renderer/modules/shared-state.js')).default;
const data = await import('../../../src/renderer/modules/categories/category-data.js');
const operations = await import('../../../src/renderer/modules/categories/category-operations.js');

describe('category data and operations', () => {
  beforeEach(() => { vi.clearAllMocks(); sharedState.set('categories', {}); });
  it('loads categories into shared state and exposes sorted/filter helpers', async () => {
    db.getCategories.mockResolvedValue({ success: true, data: [{ code: 'TALK', description: 'Talk' }, { code: 'MUSC', description: 'Music' }] });
    await expect(data.loadCategories()).resolves.toMatchObject({ success: true, data: { TALK: 'Talk', MUSC: 'Music' } });
    expect(data.getSortedCategories().map(x => x.code)).toEqual(['MUSC', 'TALK']);
    expect(data.filterCategories('talk')).toEqual([{ code: 'TALK', description: 'Talk' }]);
    expect(data.categoryExists('MUSC')).toBe(true); expect(data.getCategoryCount()).toBe(2);
  });
  it('populates selects safely and finds the next available code in one query', async () => {
    sharedState.set('categories', { TALK: 'Talk', MUSC: 'Music' });
    const select = { innerHTML: 'old', children: [], appendChild(x) { this.children.push(x); } };
    await data.populateCategorySelect(select, 'TALK');
    expect(select.children.map(x => x.value)).toEqual(['MUSC', 'TALK', '', '--NEW--']);
    expect(select.children[1].selected).toBe(true);
    db.findCategoryCodesLike.mockResolvedValue({ success: true, data: [{ code: 'ROCK' }, { code: 'ROCK2' }] });
    await expect(data.findUniqueCategoryCode('ROCK')).resolves.toBe('ROCK3');
  });
  it('rejects wrapped database failures and preserves deletion ordering', async () => {
    db.getCategories.mockResolvedValue({ success: false, error: 'offline' });
    await expect(operations.getCategories()).rejects.toThrow('offline');
    db.addCategory.mockResolvedValue({ success: true }); db.reassignSongCategory.mockResolvedValue({ success: true }); db.deleteCategory.mockResolvedValue({ success: true });
    await expect(operations.deleteCategory('OLD', 'Old')).resolves.toEqual({ success: true });
    expect(db.reassignSongCategory).toHaveBeenCalledWith('OLD', 'UNC');
    expect(db.deleteCategory).toHaveBeenCalledWith('OLD', 'Category deletion');
  });
  it('validates additions and generates a collision-safe category code', async () => {
    await expect(operations.addNewCategory('')).rejects.toThrow(/Invalid description/);
    db.findCategoryCodesLike.mockResolvedValue({ success: true, data: [] }); db.addCategory.mockResolvedValue({ success: true, id: 1 });
    await expect(operations.addNewCategory('Rock Music')).resolves.toMatchObject({ success: true });
    expect(db.addCategory).toHaveBeenCalledWith({ code: 'ROCK', description: 'Rock Music' });
  });
});
