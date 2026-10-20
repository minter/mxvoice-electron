/**
 * Board Document
 *
 * Pure data model for a profile's saved boards. A board is a named snapshot of
 * the hotkey and holding-tank layout. Every function returns a new document
 * and never mutates its input; there is no I/O here. `now` and `newId` are
 * injectable so tests are deterministic.
 *
 * Layout tabs keep exactly the shapes written to state.json today, so a 4.3.x
 * state.json migrates as-is.
 *
 * @module board-document
 */

import { randomUUID } from 'node:crypto';

export const BOARD_DOCUMENT_VERSION = 1;
export const MAX_BOARD_NAME_LENGTH = 50;
const TAB_COUNT = 5;
const HOTKEY_KEYS = Array.from({ length: 12 }, (_, i) => `f${i + 1}`);

const ERR_EMPTY = 'Enter a name for the board.';
const ERR_LONG = `Board names can be at most ${MAX_BOARD_NAME_LENGTH} characters.`;
const ERR_DUPLICATE = 'A board with this name already exists.';
const ERR_NOT_FOUND = 'Board not found.';

const defaultNow = () => Date.now();
const defaultNewId = () => randomUUID();
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNumericId = (v) => typeof v === 'string' && /^\d+$/.test(v);
const foldName = (s) => s.toLocaleLowerCase('en-US');

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

function makeBoard({ id, name, layout, now, importedFrom }) {
  const board = { id, name, createdAt: now, updatedAt: now };
  if (importedFrom) board.importedFrom = { ...importedFrom };
  board.layout = normalizeLayout(layout);
  return board;
}

export function createDocument(layout, { name = 'Board', now = defaultNow(), newId = defaultNewId } = {}) {
  const board = makeBoard({ id: newId(), name, layout, now });
  return { version: BOARD_DOCUMENT_VERSION, activeBoardId: board.id, boards: [board] };
}

export function validateBoardName(doc, name, { exceptId } = {}) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) return { ok: false, error: ERR_EMPTY };
  if (trimmed.length > MAX_BOARD_NAME_LENGTH) return { ok: false, error: ERR_LONG };
  const folded = foldName(trimmed);
  const clash = doc.boards.some((b) => b.id !== exceptId && foldName(b.name) === folded);
  if (clash) return { ok: false, error: ERR_DUPLICATE };
  return { ok: true, name: trimmed };
}

function indexOfBoard(doc, id) {
  const index = doc.boards.findIndex((b) => b.id === id);
  if (index === -1) throw new Error(ERR_NOT_FOUND);
  return index;
}

function replaceBoard(doc, index, board) {
  const boards = doc.boards.slice();
  boards[index] = board;
  return { ...doc, boards };
}

export function addBoard(
  doc,
  { name, layout, now = defaultNow(), newId = defaultNewId, activate = true, importedFrom } = {}
) {
  const check = validateBoardName(doc, name);
  if (!check.ok) throw new Error(check.error);
  const board = makeBoard({ id: newId(), name: check.name, layout, now, importedFrom });
  return {
    doc: {
      ...doc,
      activeBoardId: activate ? board.id : doc.activeBoardId,
      boards: [...doc.boards, board],
    },
    board,
  };
}

export function updateBoardLayout(doc, id, layout, now = defaultNow()) {
  const index = indexOfBoard(doc, id);
  return replaceBoard(doc, index, {
    ...doc.boards[index],
    layout: normalizeLayout(layout),
    updatedAt: now,
  });
}

export function renameBoard(doc, id, name, now = defaultNow()) {
  const index = indexOfBoard(doc, id);
  const check = validateBoardName(doc, name, { exceptId: id });
  if (!check.ok) throw new Error(check.error);
  return replaceBoard(doc, index, { ...doc.boards[index], name: check.name, updatedAt: now });
}

export function deleteBoard(doc, id, { now = defaultNow(), newId = defaultNewId } = {}) {
  const index = indexOfBoard(doc, id);
  if (doc.boards.length === 1) {
    const fresh = createDocument(emptyLayout(), { now, newId });
    return { doc: fresh, nextActiveId: fresh.activeBoardId, activeChanged: true };
  }
  const boards = doc.boards.filter((b) => b.id !== id);
  if (doc.activeBoardId !== id) {
    return {
      doc: { ...doc, boards },
      nextActiveId: doc.activeBoardId,
      activeChanged: false,
    };
  }
  const next = boards[Math.min(index, boards.length - 1)];
  return {
    doc: { ...doc, boards, activeBoardId: next.id },
    nextActiveId: next.id,
    activeChanged: true,
  };
}

export function setActive(doc, id) {
  indexOfBoard(doc, id);
  return { ...doc, activeBoardId: id };
}

export function importName(doc, boardName, sourceProfile) {
  const taken = new Set(doc.boards.map((b) => foldName(b.name)));
  const tail = ` (${sourceProfile})`;
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? '' : ` ${n}`;
    const room = MAX_BOARD_NAME_LENGTH - tail.length - suffix.length;
    // Clip the board name; if the profile part alone is too long, clip the whole string.
    let candidate =
      room >= 1
        ? `${String(boardName).slice(0, room).trimEnd()}${tail}${suffix}`
        : `${tail}${suffix}`.trim().slice(0, MAX_BOARD_NAME_LENGTH);
    if (!taken.has(foldName(candidate))) return candidate;
  }
}

export function parseDocument(raw) {
  if (!isObject(raw)) return { ok: false, error: 'shape' };
  if (typeof raw.version === 'number' && raw.version > BOARD_DOCUMENT_VERSION) {
    return { ok: false, error: 'version' };
  }
  if (!Array.isArray(raw.boards) || raw.boards.length === 0) return { ok: false, error: 'shape' };
  if (!raw.boards.every((b) => isObject(b) && typeof b.id === 'string' && typeof b.name === 'string')) {
    return { ok: false, error: 'shape' };
  }
  if (!raw.boards.some((b) => b.id === raw.activeBoardId)) return { ok: false, error: 'shape' };
  const boards = raw.boards.map((b) => ({ ...b, layout: normalizeLayout(b.layout) }));
  return { ok: true, doc: { ...raw, version: BOARD_DOCUMENT_VERSION, boards } };
}

export default {
  BOARD_DOCUMENT_VERSION,
  MAX_BOARD_NAME_LENGTH,
  emptyLayout,
  normalizeLayout,
  createDocument,
  validateBoardName,
  addBoard,
  updateBoardLayout,
  renameBoard,
  deleteBoard,
  setActive,
  importName,
  parseDocument,
};
