import { describe, expect, it } from 'vitest';
import { hasSearchCriteria } from '../../../src/renderer/modules/search/search-form-utils.js';

describe('hasSearchCriteria', () => {
  it('counts a search term', () => {
    expect(hasSearchCriteria({ searchTerm: 'anthem', advancedFilters: null })).toBe(true);
  });

  it('counts any non-empty advanced field', () => {
    expect(hasSearchCriteria({ searchTerm: null, advancedFilters: { title: '', artist: 'Band', info: '', since: '' } })).toBe(true);
  });

  it('ignores an open advanced panel with every field empty', () => {
    expect(hasSearchCriteria({ searchTerm: null, advancedFilters: { title: '', artist: '', info: '', since: '' } })).toBe(false);
  });

  it('ignores a category-only browse', () => {
    expect(hasSearchCriteria({ category: 'MUS', searchTerm: null, advancedFilters: null })).toBe(false);
  });
});
