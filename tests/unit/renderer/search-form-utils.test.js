import { describe, it, expect, beforeEach, vi } from 'vitest';

// Provide a minimal DOM stub — search-form-utils uses document.getElementById
globalThis.window = globalThis.window || {};
globalThis.document = globalThis.document || {};

// Map of element ids to mock elements
let elements;

function makeInput(value = '') {
  return { value };
}

function makeDiv(visible = true) {
  return { offsetParent: visible ? {} : null };
}

// Stub document.getElementById to return our mock elements
globalThis.document.getElementById = vi.fn((id) => elements[id] || null);

const { getAdvancedSearchValues, hasActiveAdvancedFilters } = await import(
  '../../../src/renderer/modules/search/search-form-utils.js'
);

describe('search-form-utils', () => {
  beforeEach(() => {
    elements = {};
    vi.clearAllMocks();
  });

  // ── getAdvancedSearchValues ─────────────────────────────────────────

  describe('getAdvancedSearchValues', () => {
    it('returns trimmed values from form fields', () => {
      elements['title-search'] = makeInput('  My Title  ');
      elements['artist-search'] = makeInput(' Artist ');
      elements['info-search'] = makeInput('Info');
      elements['date-search'] = makeInput('2024-01-01');

      const result = getAdvancedSearchValues();
      expect(result).toEqual({
        title: 'My Title',
        artist: 'Artist',
        info: 'Info',
        since: '2024-01-01',
      });
    });

    it('returns empty strings when fields are missing', () => {
      // No elements registered
      const result = getAdvancedSearchValues();
      expect(result).toEqual({
        title: '',
        artist: '',
        info: '',
        since: '',
      });
    });

    it('returns empty strings when fields have empty values', () => {
      elements['title-search'] = makeInput('');
      elements['artist-search'] = makeInput('   ');
      elements['info-search'] = makeInput('');
      elements['date-search'] = makeInput('');

      const result = getAdvancedSearchValues();
      expect(result.title).toBe('');
      expect(result.artist).toBe('');
      expect(result.info).toBe('');
      expect(result.since).toBe('');
    });
  });

  // ── hasActiveAdvancedFilters ────────────────────────────────────────

  describe('hasActiveAdvancedFilters', () => {
    it('returns false when advanced-search element does not exist', () => {
      expect(hasActiveAdvancedFilters()).toBe(false);
    });

    it('returns false when advanced-search is not visible (offsetParent null)', () => {
      elements['advanced-search'] = makeDiv(false);
      elements['title-search'] = makeInput('something');
      expect(hasActiveAdvancedFilters()).toBe(false);
    });

    it('returns false when visible but all fields are empty', () => {
      elements['advanced-search'] = makeDiv(true);
      elements['title-search'] = makeInput('');
      elements['artist-search'] = makeInput('');
      elements['info-search'] = makeInput('');
      elements['date-search'] = makeInput('');
      expect(hasActiveAdvancedFilters()).toBe(false);
    });

    it('returns true when title has a value', () => {
      elements['advanced-search'] = makeDiv(true);
      elements['title-search'] = makeInput('test');
      expect(hasActiveAdvancedFilters()).toBe(true);
    });

    it('returns true when artist has a value', () => {
      elements['advanced-search'] = makeDiv(true);
      elements['artist-search'] = makeInput('artist');
      expect(hasActiveAdvancedFilters()).toBe(true);
    });

    it('returns true when info has a value', () => {
      elements['advanced-search'] = makeDiv(true);
      elements['info-search'] = makeInput('info');
      expect(hasActiveAdvancedFilters()).toBe(true);
    });

    it('returns true when since/date has a value', () => {
      elements['advanced-search'] = makeDiv(true);
      elements['date-search'] = makeInput('2024-06-01');
      expect(hasActiveAdvancedFilters()).toBe(true);
    });
  });
});
