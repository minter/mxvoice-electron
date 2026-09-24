/**
 * Library Stats
 *
 * Reads library size for the `library_stats` analytics event.
 *
 * @module library-stats
 */

/**
 * Count songs and categories in the library database.
 *
 * node-sqlite3-wasm's `exec()` returns nothing, so rows must be read with `get()`.
 *
 * @param {Object} db - node-sqlite3-wasm Database
 * @returns {{ song_count: number, category_count: number }}
 */
export function collectLibraryStats(db) {
  const songs = db.get('SELECT count(*) AS count FROM mrvoice');
  const categories = db.get('SELECT count(*) AS count FROM categories');
  return {
    song_count: Number(songs?.count) || 0,
    category_count: Number(categories?.count) || 0,
  };
}
