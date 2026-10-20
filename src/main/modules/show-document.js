/**
 * Show Document
 *
 * Pure data model for a profile's saved shows. A show is a named snapshot of
 * the hotkey and holding-tank layout. Every function returns a new document
 * and never mutates its input; there is no I/O here. `now` and `newId` are
 * injectable so tests are deterministic.
 *
 * Layout tabs keep exactly the shapes written to state.json today, so a 4.3.x
 * state.json migrates as-is.
 *
 * @module show-document
 */

import { randomUUID } from 'node:crypto';

export const SHOW_DOCUMENT_VERSION = 1;
export const MAX_SHOW_NAME_LENGTH = 50;
const MAX_IMPORT_NAME_ATTEMPTS = 1000;
const TAB_COUNT = 5;
const HOTKEY_KEYS = Array.from({ length: 12 }, (_, i) => `f${i + 1}`);

const ERR_EMPTY = 'Enter a name for the show.';
const ERR_LONG = `Show names can be at most ${MAX_SHOW_NAME_LENGTH} characters.`;
const ERR_DUPLICATE = 'A show with this name already exists.';
const ERR_CONTROL = "Show names can't contain line breaks or control characters.";
const ERR_NOT_FOUND = 'Show not found.';

const defaultNow = () => Date.now();
const defaultNewId = () => randomUUID();
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNumericId = (v) => typeof v === 'string' && /^\d+$/.test(v);
const foldName = (s) => s.toLocaleLowerCase('en-US');
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

/** A name validation failure; show IPC results pass its code on. */
function nameError(message) {
  return Object.assign(new Error(message), { code: 'invalid-name' });
}

function pickSelected(value) {
  return Number.isInteger(value) && value >= 1 && value <= TAB_COUNT ? value : 1;
}

function tabsByNumber(rawTabs) {
  const byNumber = new Map();
  if (!Array.isArray(rawTabs)) return byNumber;
  for (const tab of rawTabs) {
    if (!isObject(tab)) continue;
    const n = tab.tabNumber;
    if (Number.isInteger(n) && n >= 1 && n <= TAB_COUNT && !byNumber.has(n)) {
      byNumber.set(n, tab);
    }
  }
  return byNumber;
}

function tabName(tab) {
  return tab && typeof tab.tabName === 'string' ? tab.tabName : null;
}

export function emptyLayout() {
  return normalizeLayout(null);
}

export function normalizeLayout(raw) {
  const src = isObject(raw) ? raw : {};
  const hotkeyTabs = tabsByNumber(src.hotkeys);
  const tankTabs = tabsByNumber(src.holdingTank);
  const selected = isObject(src.selected) ? src.selected : {};

  const hotkeys = [];
  const holdingTank = [];
  for (let n = 1; n <= TAB_COUNT; n++) {
    const hk = hotkeyTabs.get(n);
    const assigned = {};
    if (hk && isObject(hk.hotkeys)) {
      for (const key of HOTKEY_KEYS) {
        if (isNumericId(hk.hotkeys[key])) assigned[key] = hk.hotkeys[key];
      }
    }
    hotkeys.push({ tabNumber: n, tabName: tabName(hk), hotkeys: assigned });

    const ht = tankTabs.get(n);
    const songIds = ht && Array.isArray(ht.songIds) ? ht.songIds.filter(isNumericId) : [];
    holdingTank.push({ tabNumber: n, tabName: tabName(ht), songIds });
  }

  return {
    hotkeys,
    holdingTank,
    selected: {
      hotkeyTab: pickSelected(selected.hotkeyTab),
      holdingTankTab: pickSelected(selected.holdingTankTab),
    },
  };
}

function makeShow({ id, name, layout, now, importedFrom }) {
  const show = { id, name, createdAt: now, updatedAt: now };
  if (importedFrom) show.importedFrom = { ...importedFrom };
  show.layout = normalizeLayout(layout);
  return show;
}

export function createDocument(layout, { name = 'Show', now = defaultNow(), newId = defaultNewId } = {}) {
  const show = makeShow({ id: newId(), name, layout, now });
  return { version: SHOW_DOCUMENT_VERSION, activeShowId: show.id, shows: [show] };
}

export function validateShowName(doc, name, { exceptId } = {}) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) return { ok: false, error: ERR_EMPTY };
  if (trimmed.length > MAX_SHOW_NAME_LENGTH) return { ok: false, error: ERR_LONG };
  if (CONTROL_CHARS.test(trimmed)) return { ok: false, error: ERR_CONTROL };
  const folded = foldName(trimmed);
  const clash = doc.shows.some((b) => b.id !== exceptId && foldName(b.name) === folded);
  if (clash) return { ok: false, error: ERR_DUPLICATE };
  return { ok: true, name: trimmed };
}

function indexOfShow(doc, id) {
  const index = doc.shows.findIndex((b) => b.id === id);
  if (index === -1) throw new Error(ERR_NOT_FOUND);
  return index;
}

function replaceShow(doc, index, show) {
  const shows = doc.shows.slice();
  shows[index] = show;
  return { ...doc, shows };
}

export function addShow(
  doc,
  { name, layout, now = defaultNow(), newId = defaultNewId, activate = true, importedFrom } = {}
) {
  const check = validateShowName(doc, name);
  if (!check.ok) throw nameError(check.error);
  const show = makeShow({ id: newId(), name: check.name, layout, now, importedFrom });
  return {
    doc: {
      ...doc,
      activeShowId: activate ? show.id : doc.activeShowId,
      shows: [...doc.shows, show],
    },
    show,
  };
}

export function updateShowLayout(doc, id, layout, now = defaultNow()) {
  const index = indexOfShow(doc, id);
  return replaceShow(doc, index, {
    ...doc.shows[index],
    layout: normalizeLayout(layout),
    updatedAt: now,
  });
}

export function renameShow(doc, id, name, now = defaultNow()) {
  const index = indexOfShow(doc, id);
  const check = validateShowName(doc, name, { exceptId: id });
  if (!check.ok) throw nameError(check.error);
  return replaceShow(doc, index, { ...doc.shows[index], name: check.name, updatedAt: now });
}

export function deleteShow(doc, id, { now = defaultNow(), newId = defaultNewId } = {}) {
  const index = indexOfShow(doc, id);
  if (doc.shows.length === 1) {
    const fresh = createDocument(emptyLayout(), { now, newId });
    return { doc: fresh, nextActiveId: fresh.activeShowId, activeChanged: true };
  }
  const shows = doc.shows.filter((b) => b.id !== id);
  if (doc.activeShowId !== id) {
    return {
      doc: { ...doc, shows },
      nextActiveId: doc.activeShowId,
      activeChanged: false,
    };
  }
  const next = shows[Math.min(index, shows.length - 1)];
  return {
    doc: { ...doc, shows, activeShowId: next.id },
    nextActiveId: next.id,
    activeChanged: true,
  };
}

export function setActive(doc, id) {
  indexOfShow(doc, id);
  return { ...doc, activeShowId: id };
}

export function importName(doc, showName, sourceProfile) {
  const taken = new Set(doc.shows.map((b) => foldName(b.name)));
  const show = String(showName ?? '').trim() || 'Show';
  const profile = String(sourceProfile ?? '');
  for (let n = 1; n <= MAX_IMPORT_NAME_ATTEMPTS; n++) {
    const suffix = n === 1 ? '' : ` ${n}`;
    // " (" + ")" add 3 characters around the profile.
    const room = MAX_SHOW_NAME_LENGTH - 3 - profile.length - suffix.length;
    let candidate;
    if (room >= 1) {
      candidate = `${show.slice(0, room).trimEnd()} (${profile})${suffix}`;
    } else {
      // Show part is down to one character; clip the profile and mark it.
      const profileRoom = MAX_SHOW_NAME_LENGTH - 1 - 3 - suffix.length;
      const clipped =
        profile.length > profileRoom ? `${profile.slice(0, profileRoom - 1)}…` : profile;
      candidate = `${show.slice(0, 1)} (${clipped})${suffix}`;
    }
    if (!taken.has(foldName(candidate))) return candidate;
  }
  throw new Error('Could not find a free name for the imported show.');
}

function futureVersion(version) {
  const num =
    typeof version === 'number'
      ? version
      : typeof version === 'string' && /^\s*\d+\s*$/.test(version)
        ? Number(version)
        : NaN;
  return Number.isInteger(num) && num > SHOW_DOCUMENT_VERSION;
}

export function parseDocument(raw) {
  if (!isObject(raw)) return { ok: false, error: 'shape' };
  if (raw.version !== SHOW_DOCUMENT_VERSION) {
    return { ok: false, error: futureVersion(raw.version) ? 'version' : 'shape' };
  }
  if (!Array.isArray(raw.shows) || raw.shows.length === 0) return { ok: false, error: 'shape' };
  if (!raw.shows.every((b) => isObject(b) && typeof b.id === 'string' && typeof b.name === 'string')) {
    return { ok: false, error: 'shape' };
  }
  if (new Set(raw.shows.map((b) => b.id)).size !== raw.shows.length) {
    return { ok: false, error: 'shape' };
  }
  if (!raw.shows.some((b) => b.id === raw.activeShowId)) return { ok: false, error: 'shape' };
  const shows = raw.shows.map((b) => ({ ...b, layout: normalizeLayout(b.layout) }));
  return { ok: true, doc: { ...raw, shows } };
}

export default {
  SHOW_DOCUMENT_VERSION,
  MAX_SHOW_NAME_LENGTH,
  emptyLayout,
  normalizeLayout,
  createDocument,
  validateShowName,
  addShow,
  updateShowLayout,
  renameShow,
  deleteShow,
  setActive,
  importName,
  parseDocument,
};
