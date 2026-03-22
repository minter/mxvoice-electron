/**
 * Search Form Utilities
 *
 * Shared helpers for reading search form values, used by search-engine,
 * live-search, and search/index modules.
 */

/**
 * Read advanced search form field values.
 * @returns {{ title: string, artist: string, info: string, since: string }}
 */
export function getAdvancedSearchValues() {
  return {
    title: (document.getElementById('title-search')?.value || '').trim(),
    artist: (document.getElementById('artist-search')?.value || '').trim(),
    info: (document.getElementById('info-search')?.value || '').trim(),
    since: document.getElementById('date-search')?.value || '',
  };
}

/**
 * Check whether the advanced search panel is visible and has any filters set.
 * @returns {boolean}
 */
export function hasActiveAdvancedFilters() {
  const adv = document.getElementById('advanced-search');
  if (!adv || adv.offsetParent === null) return false;
  const { title, artist, info, since } = getAdvancedSearchValues();
  return title.length > 0 || artist.length > 0 || info.length > 0 || since.length > 0;
}
