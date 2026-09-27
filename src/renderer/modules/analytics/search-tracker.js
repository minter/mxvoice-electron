/**
 * Search Tracker
 *
 * Records `search_performed` once per settled query rather than once per
 * search run. Live search runs on every typing pause, so a query only counts
 * after it has stopped changing; the same query re-run shortly afterwards
 * (e.g. pressing Enter on a live result) is not counted twice.
 *
 * The query text is used only in memory for deduping and is never sent.
 */

export const SEARCH_SETTLE_MS = 1500;
const DUPLICATE_WINDOW_MS = 60_000;

let pending = null;
let lastSent = null;

/**
 * Queue a completed search; it is sent once no newer search replaces it.
 *
 * @param {Object} params
 * @param {string} params.signature - Identifies the query (term, category, filters)
 * @param {number} params.resultCount - Number of songs returned
 * @param {'live'|'submit'} params.source - How the search was run
 */
export function recordSearch({ signature, resultCount, source }) {
  if (pending) clearTimeout(pending.timer);
  pending = null;

  if (lastSent?.signature === signature && Date.now() - lastSent.at < DUPLICATE_WINDOW_MS) return;

  pending = {
    signature,
    properties: { result_count: resultCount, source },
    timer: setTimeout(flushPendingSearch, SEARCH_SETTLE_MS),
  };
}

/**
 * Send the queued search now. Called before `song_played` so a play from
 * search results always follows its search in the event stream.
 */
export function flushPendingSearch() {
  if (!pending) return;
  clearTimeout(pending.timer);
  const { signature, properties } = pending;
  pending = null;
  lastSent = { signature, at: Date.now() };
  window.secureElectronAPI?.analytics?.trackEvent?.('search_performed', properties);
}

/** Clear tracker state (for tests). */
export function resetSearchTracker() {
  if (pending) clearTimeout(pending.timer);
  pending = null;
  lastSent = null;
}
