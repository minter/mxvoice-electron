/**
 * Legacy Config Layout
 *
 * Mx. Voice 3.x and 4.0 kept hotkeys and the holding tank as the columns'
 * HTML, in the global config.json keys `hotkeys` and `holding_tank`. This
 * reads the song ids out of that HTML into a show layout, following the rules
 * 4.3.2's one-time migration used:
 *   - hotkeys: the first element with id `hotkeys_list_N` (N = 1..5) is tab N;
 *     inside it, the first element with id `fK_hotkey` and a songid is key fK;
 *   - holding tank: the first element with id `holding_tank_N` is tab N; its
 *     `li` elements with a songid are the songs, in row order.
 * Only the first copy of a tab counts: 3.x appended clones of tab 1 on every
 * launch, so later copies hold stale songs.
 *
 * Main has no DOM, so this tokenizes tags with regexes. Only `songid` values
 * made of digits are read; nothing else from the HTML is used.
 *
 * @module legacy-config-layout
 */

const TAB_COUNT = 5;
const KEY_COUNT = 12;

const COMMENT = /<!--[\s\S]*?(?:-->|$)/g;
// A start or end tag; quoted attribute values may contain '>'. Attributes must
// be whitespace-separated (as innerHTML writes them) so truncated input can't
// make the pattern backtrack exponentially.
const TAG = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g;
const ATTRIBUTE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const DIGITS = /^\d+$/;

function attributesOf(text) {
  const attrs = {};
  for (const m of text.matchAll(ATTRIBUTE)) {
    const name = m[1].toLowerCase();
    if (!(name in attrs)) attrs[name] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

function* tagsOf(html) {
  for (const m of html.replace(COMMENT, '').matchAll(TAG)) {
    yield { closing: m[1] === '/', name: m[2].toLowerCase(), attrs: attributesOf(m[3]) };
  }
}

/** The number from `id` when it is `<prefix>N<suffix>` with N in 1..max, else 0. */
function numberedId(id, prefix, suffix, max) {
  if (typeof id !== 'string' || !id.startsWith(prefix) || !id.endsWith(suffix)) return 0;
  const digits = id.slice(prefix.length, id.length - suffix.length);
  if (!DIGITS.test(digits)) return 0;
  const n = Number(digits);
  return n >= 1 && n <= max ? n : 0;
}

/**
 * Walk the HTML and call `visit(tabNumber, tag)` for each start tag inside the
 * first copy of each tab whose id is `<prefix>N`.
 */
function walkTabs(html, prefix, visit) {
  const seen = new Set();
  let tab = 0;
  let tabTag = '';
  let depth = 0;
  for (const tag of tagsOf(html)) {
    if (!tab) {
      const n = tag.closing ? 0 : numberedId(tag.attrs.id, prefix, '', TAB_COUNT);
      if (n && !seen.has(n)) {
        seen.add(n);
        tab = n;
        tabTag = tag.name;
        depth = 1;
      }
      continue;
    }
    if (tag.name === tabTag) depth += tag.closing ? -1 : 1;
    if (depth === 0) {
      tab = 0;
      continue;
    }
    if (!tag.closing) visit(tab, tag);
  }
}

const songIdOf = (tag) => (DIGITS.test(tag.attrs.songid ?? '') ? tag.attrs.songid : null);

function parseHotkeys(html) {
  const tabs = new Map();
  walkTabs(html, 'hotkeys_list_', (tab, tag) => {
    const key = numberedId(tag.attrs.id, 'f', '_hotkey', KEY_COUNT);
    const songId = songIdOf(tag);
    if (!key || !songId) return;
    if (!tabs.has(tab)) tabs.set(tab, {});
    const assigned = tabs.get(tab);
    if (!(`f${key}` in assigned)) assigned[`f${key}`] = songId;
  });
  return tabs;
}

function parseHoldingTank(html) {
  const tabs = new Map();
  walkTabs(html, 'holding_tank_', (tab, tag) => {
    const songId = tag.name === 'li' ? songIdOf(tag) : null;
    if (!songId) return;
    if (!tabs.has(tab)) tabs.set(tab, []);
    tabs.get(tab).push(songId);
  });
  return tabs;
}

const hasSongs = (value) => typeof value === 'string' && value.includes('songid=');

/**
 * Read the legacy `hotkeys` / `holding_tank` HTML in a config.json object.
 * @param {object} config - the parsed config.json
 * @returns {{hotkeys: object[], holdingTank: object[]}|null} a layout for
 *   normalizeLayout, or null when neither column holds a usable song
 */
export function parseLegacyConfigLayout(config) {
  if (config === null || typeof config !== 'object') return null;
  const hotkeyTabs = hasSongs(config.hotkeys) ? parseHotkeys(config.hotkeys) : new Map();
  const tankTabs = hasSongs(config.holding_tank) ? parseHoldingTank(config.holding_tank) : new Map();
  if (hotkeyTabs.size === 0 && tankTabs.size === 0) return null;

  const hotkeys = [];
  const holdingTank = [];
  for (let n = 1; n <= TAB_COUNT; n++) {
    hotkeys.push({ tabNumber: n, tabName: null, hotkeys: hotkeyTabs.get(n) || {} });
    holdingTank.push({ tabNumber: n, tabName: null, songIds: tankTabs.get(n) || [] });
  }
  return { hotkeys, holdingTank };
}

export default { parseLegacyConfigLayout };
