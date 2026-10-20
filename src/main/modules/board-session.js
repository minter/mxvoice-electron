/**
 * Board Session
 *
 * Per-process state for the live session: which profile's active board is
 * open, whether the page has applied it, and whether crash-recovery writes
 * are still allowed. See docs/superpowers/specs/2026-10-17-boards-design.md.
 *
 * The profile is captured at `open()`. Every later recovery write, handoff
 * and retire uses that captured profile, never `getCurrentProfile()`, so a
 * late write from the old page can't land in a new profile mid-switch.
 *
 * `end()` is the only way out of a session. It raises a fence first, waits
 * for any recovery write already in flight, then retires. The fence stays up
 * until the next `open()`.
 *
 * Board mutations need a ready, unfenced session and run one at a time; a
 * second call while one runs is rejected as 'busy'. Each saves the board
 * document first and only then updates the session. The ones that change
 * the active board (activate, revert, deleting the active board, import)
 * raise the fence before their first await, retire, and leave the session
 * 'loading' at a new generation for the page to apply and report ready.
 *
 * @module board-session
 */

import { BoardStoreError } from './board-store.js';
import {
  addBoard,
  deleteBoard as deleteFromDocument,
  importName,
  normalizeLayout,
  renameBoard as renameInDocument,
  setActive,
  updateBoardLayout
} from './board-document.js';

// An update or renderer-crash handoff older than this falls back to the
// normal crash prompt instead of a silent restore.
export const HANDOFF_MAX_AGE_MS = 15 * 60 * 1000;

const FAILED_CODES = new Set(['io', 'version', 'unregistered', 'shape']);
const END_REASONS = new Set(['clean-exit', 'switch', 'backup-restore', 'library-import', 'profile-deleted']);
// Exits that keep the record once it has been handed off to the next open,
// or when the board never became ready
const KEPT_AFTER_HANDOFF = new Set(['clean-exit', 'switch']);
const DEFAULT_PROFILE = 'Default User';

/** Default User first, then case-insensitive by name, as the profile picker sorts. */
function compareProfiles(a, b) {
  if (a === DEFAULT_PROFILE) return -1;
  if (b === DEFAULT_PROFILE) return 1;
  return a.toLowerCase().localeCompare(b.toLowerCase());
}

/** Stable comparison of two layouts, ignoring the selected tabs. */
function layoutKey(layout) {
  const { selected: _selected, ...rest } = normalizeLayout(layout);
  return JSON.stringify(rest);
}

/**
 * @param {Object} deps
 * @param {Object} deps.boardStore - from createBoardStore
 * @param {Object} deps.recoveryStore - from createRecoveryStore
 * @param {() => string[]} [deps.listProfiles] - names of every registered profile
 * @param {() => string|null} deps.getCurrentProfile
 * @param {() => void} [deps.rebuildMenu]
 * @param {() => number} [deps.now]
 * @param {() => string} [deps.newId] - id for a new board
 * @param {Object} [deps.debugLog]
 */
export function createBoardSession({
  boardStore,
  recoveryStore,
  listProfiles = () => [],
  getCurrentProfile,
  rebuildMenu,
  now = Date.now,
  newId,
  debugLog
}) {
  const logCtx = (fn) => ({ module: 'board-session', function: fn });

  let profile = null;
  let status = 'idle';
  let doc = null;
  let generation = 0;
  let fenced = false;
  // Set by a handoff: the record now belongs to the next open, so a following
  // clean exit or switch must keep it
  let handedOff = false;
  let pendingHandoff = null;
  // Set once end() has run for this session; cleared by the next open()
  let ended = false;
  // The record reported by open(), until resolveRecovery() settles it
  let pendingRecovery = null;
  // Recovery writes run one at a time, so end() can wait out the last one
  let writeQueue = Promise.resolve();
  // Set while a board mutation runs
  let mutating = false;

  function refreshMenu(fn) {
    try {
      rebuildMenu?.();
    } catch (error) {
      debugLog?.warn?.('Menu rebuild failed', { ...logCtx(fn), error: error.message });
    }
  }

  function setStatus(next) {
    if (status === next) return;
    status = next;
    refreshMenu('setStatus');
  }

  function activeBoard() {
    return doc?.boards.find((b) => b.id === doc.activeBoardId) ?? null;
  }

  function queued(task) {
    const run = writeQueue.then(task);
    writeQueue = run.catch(() => {});
    return run;
  }

  const state = () => ({ profile, status, doc, generation });

  async function open() {
    profile = getCurrentProfile();
    generation += 1;
    const myGeneration = generation;
    fenced = false;
    handedOff = false;
    ended = false;
    pendingHandoff = null;
    pendingRecovery = null;
    doc = null;
    setStatus('loading');

    let loaded;
    try {
      loaded = await boardStore.load(profile);
    } catch (error) {
      if (myGeneration !== generation) throw new Error('superseded by a newer open', { cause: error });
      if (error instanceof BoardStoreError && error.code === 'unreadable') {
        setStatus('unreadable');
        return { unreadable: true, generation };
      }
      setStatus('failed');
      debugLog?.error?.('Could not open the active board', { ...logCtx('open'), code: error?.code, error: error?.message });
      if (error instanceof BoardStoreError && FAILED_CODES.has(error.code)) {
        return { failed: true, error: error.code, generation };
      }
      throw error;
    }

    let record = null;
    try {
      record = await recoveryStore.read(profile);
    } catch (error) {
      // A recovery record that can't be read is treated as no record
      debugLog?.warn?.('Could not read the recovery record', { ...logCtx('open'), error: error.message });
    }
    if (myGeneration !== generation) throw new Error('superseded by a newer open');

    doc = loaded.doc;
    pendingRecovery = record;
    const board = activeBoard();
    const result = {
      doc,
      board: { ...board, layout: normalizeLayout(board.layout) },
      recovery: null,
      generation
    };
    if (record) {
      const fresh = now() - record.savedAt <= HANDOFF_MAX_AGE_MS;
      result.recovery = {
        savedAt: record.savedAt,
        handoff: record.handoff && fresh ? record.handoff : null,
        boardId: record.boardId
      };
    }
    if (loaded.notice) result.notice = loaded.notice;
    return result;
  }

  async function startEmpty() {
    if (status !== 'unreadable') throw new Error('startEmpty is only allowed when the boards are unreadable');
    const p = profile;
    const g = generation;
    const { doc: emptyDoc } = await boardStore.resetUnreadable(p);
    if (generation !== g) throw new Error('superseded by a newer open');
    doc = emptyDoc;
    setStatus('loading');
    return { layout: normalizeLayout(activeBoard().layout), generation };
  }

  async function resolveRecovery(choice) {
    if (choice !== 'restore' && choice !== 'discard') throw new Error(`Invalid recovery choice: ${String(choice)}`);
    if (!doc) throw new Error('No board is open');
    const p = profile;
    const record = pendingRecovery;
    pendingRecovery = null;
    const saved = normalizeLayout(activeBoard().layout);
    if (!record) return { layout: saved };
    // Restored onto the active board, whatever boardId the record names.
    // A handoff is spent once restored: another crash before any edit must ask.
    if (choice === 'restore') {
      if (record.handoff) await queued(() => recoveryStore.clearHandoff(p));
      return { layout: normalizeLayout(record.layout) };
    }
    await queued(() => recoveryStore.retire(p));
    return { layout: saved };
  }

  function reportReady(reportedGeneration, ok) {
    // A failed open() already set 'failed'; the page's failed report confirms it
    if (!ok && reportedGeneration === generation && status === 'failed') return;
    if (reportedGeneration !== generation || status !== 'loading') {
      debugLog?.info?.('Ignoring stale board ready report', { ...logCtx('reportReady'), reportedGeneration, generation, status });
      return;
    }
    setStatus(ok ? 'ready' : 'failed');
  }

  const refused = (myGeneration) => status !== 'ready' || fenced || myGeneration !== generation;

  function saveRecovery(layout) {
    const myGeneration = generation;
    const p = profile;
    if (refused(myGeneration)) return Promise.resolve({ skipped: true });
    const normalized = normalizeLayout(layout);
    return queued(async () => {
      // Re-checked here: end() may have fenced while this waited its turn
      if (refused(myGeneration)) return { skipped: true };
      const board = activeBoard();
      if (layoutKey(normalized) === layoutKey(board.layout)) {
        await recoveryStore.retire(p);
        return { retired: true };
      }
      await recoveryStore.write(p, { boardId: board.id, layout: normalized });
      return {};
    });
  }

  // end() and handoff() capture the session they were called for. An open()
  // that runs while they await must not have its profile retired or marked,
  // or its status overwritten.
  async function end(reason) {
    if (!END_REASONS.has(reason)) throw new Error(`Invalid session end reason: ${String(reason)}`);
    if (!profile || ended) return;
    const p = profile;
    const g = generation;
    // A board that never became ready (crash prompt still open, failed or
    // unreadable open) never replaced the record, so quitting or switching
    // must leave it for the next open
    const neverReady = status !== 'ready';
    const kept = (handedOff || neverReady) && KEPT_AFTER_HANDOFF.has(reason);
    const handoffDone = pendingHandoff;
    ended = true;
    fenced = true;
    if (handoffDone) await handoffDone;
    await writeQueue;
    if (reason === 'library-import') {
      await recoveryStore.clearAll();
    } else if (!kept) {
      await recoveryStore.retire(p);
    }
    if (generation === g) {
      pendingRecovery = null;
      setStatus('idle');
    }
  }

  async function handoff(reason) {
    if (!profile || ended) return;
    const p = profile;
    fenced = true;
    handedOff = true;
    // Queued, so a mutation's retire can't land between its read and write
    // and have the old record written back
    await queued(() => recoveryStore.markHandoff(p, reason));
  }

  function rendererGone() {
    if (!profile || ended) return;
    // handoff() captures the profile before its first await
    pendingHandoff = handoff('renderer-crash').catch((error) => {
      debugLog?.error?.('Could not mark the recovery record after a renderer crash', {
        ...logCtx('rendererGone'),
        error: error.message
      });
    });
  }

  // --- Board mutations ---

  const idOptions = () => (newId ? { newId } : {});

  /**
   * Run one board mutation. The task gets the profile, generation and doc
   * captured here and runs synchronously up to its first await, so a task
   * can raise the fence before anything else gets a turn.
   *
   * The menu is rebuilt however the mutation ends: Electron moves a radio
   * check on click, so a rejected switch must put the check back.
   */
  async function mutation(fn, task) {
    if (mutating || status !== 'ready' || fenced) {
      refreshMenu(fn);
      throw new Error(mutating ? 'busy' : 'session not ready');
    }
    mutating = true;
    try {
      return await task({ p: profile, g: generation, d: doc });
    } finally {
      refreshMenu(fn);
      mutating = false;
    }
  }

  function assertCurrent(g) {
    if (generation !== g || ended) throw new Error('superseded by a newer open or the end of the session');
  }

  // Undo a mutation's fence after it failed, unless the session has moved
  // on or a handoff or end() wants it kept up
  function lowerFence(g) {
    if (generation === g && !ended && !handedOff) fenced = false;
  }

  // The board is already saved by now, so a failed retire is only logged:
  // the next recovery write replaces the stale record
  async function retireRecovery(fn, p) {
    try {
      await queued(() => recoveryStore.retire(p));
    } catch (error) {
      debugLog?.warn?.('Could not retire the recovery record', { ...logCtx(fn), error: error.message });
    }
  }

  /** Save a document that keeps the active board, then adopt it. */
  async function saveInPlace(fn, p, g, nextDoc, { retire }) {
    await boardStore.save(p, nextDoc);
    assertCurrent(g);
    doc = nextDoc;
    if (retire) await retireRecovery(fn, p);
  }

  /**
   * Finish a mutation that changes the board on screen. The caller has
   * already raised the fence. Saves `nextDoc` (none for a revert), retires,
   * then starts a new generation in 'loading'.
   */
  async function reload(fn, p, g, nextDoc) {
    try {
      if (nextDoc) await boardStore.save(p, nextDoc);
      assertCurrent(g);
    } catch (error) {
      lowerFence(g);
      throw error;
    }
    if (nextDoc) doc = nextDoc;
    await retireRecovery(fn, p);
    assertCurrent(g);
    generation += 1;
    pendingRecovery = null;
    // Writes stay refused while loading, by status and by generation
    if (!handedOff) fenced = false;
    setStatus('loading');
    return { layout: normalizeLayout(activeBoard().layout), generation };
  }

  function activate(boardId) {
    return mutation('activate', ({ p, g, d }) => {
      if (boardId === d.activeBoardId) throw new Error('already active');
      const nextDoc = setActive(d, boardId);
      fenced = true;
      return reload('activate', p, g, nextDoc);
    });
  }

  function revert() {
    return mutation('revert', ({ p, g }) => {
      fenced = true;
      return reload('revert', p, g, null);
    });
  }

  function updateActive(layout) {
    return mutation('updateActive', async ({ p, g, d }) => {
      const nextDoc = updateBoardLayout(d, d.activeBoardId, normalizeLayout(layout), now());
      await saveInPlace('updateActive', p, g, nextDoc, { retire: true });
    });
  }

  function createBoard(name, layout) {
    return mutation('createBoard', async ({ p, g, d }) => {
      const { doc: nextDoc, board } = addBoard(d, {
        name,
        layout: normalizeLayout(layout),
        now: now(),
        ...idOptions()
      });
      await saveInPlace('createBoard', p, g, nextDoc, { retire: true });
      return { id: board.id, name: board.name };
    });
  }

  function renameBoard(boardId, name) {
    return mutation('renameBoard', async ({ p, g, d }) => {
      const nextDoc = renameInDocument(d, boardId, name, now());
      await saveInPlace('renameBoard', p, g, nextDoc, { retire: false });
      const renamed = nextDoc.boards.find((b) => b.id === boardId);
      return { id: renamed.id, name: renamed.name };
    });
  }

  function deleteBoard(boardId) {
    return mutation('deleteBoard', async ({ p, g, d }) => {
      const { doc: nextDoc, activeChanged } = deleteFromDocument(d, boardId, { now: now(), ...idOptions() });
      if (!activeChanged) {
        await saveInPlace('deleteBoard', p, g, nextDoc, { retire: false });
        return { activeChanged: false };
      }
      fenced = true;
      return { activeChanged: true, ...(await reload('deleteBoard', p, g, nextDoc)) };
    });
  }

  /** Every other registered profile's boards, read without writing. */
  async function listImportable() {
    const p = profile;
    if (!p) throw new Error('No profile is open');
    const names = listProfiles().filter((name) => name !== p).sort(compareProfiles);
    const result = [];
    for (const name of names) {
      let peeked = null;
      try {
        peeked = await boardStore.peek(name);
      } catch (error) {
        debugLog?.warn?.('Could not read another profile\'s boards', { ...logCtx('listImportable'), error: error.message });
      }
      if (!peeked) continue;
      result.push({
        profile: name,
        boards: peeked.boards.map(({ id, name: boardName, updatedAt }) => ({ id, name: boardName, updatedAt }))
      });
    }
    return result;
  }

  function importBoard(sourceProfile, boardId) {
    return mutation('importBoard', async ({ p, g, d }) => {
      if (typeof sourceProfile !== 'string' || !listProfiles().includes(sourceProfile)) {
        throw new Error(`Profile "${String(sourceProfile)}" is not registered`);
      }
      if (sourceProfile === p) throw new Error('Cannot import from the current profile');
      fenced = true;
      let nextDoc;
      try {
        // peek never writes the source profile's files
        const source = (await boardStore.peek(sourceProfile))?.boards.find((b) => b.id === boardId);
        if (!source) throw new Error('Board not found.');
        assertCurrent(g);
        const at = now();
        nextDoc = addBoard(d, {
          name: importName(d, source.name, sourceProfile),
          layout: source.layout,
          now: at,
          ...idOptions(),
          importedFrom: { profile: sourceProfile, boardId, boardName: source.name, at }
        }).doc;
      } catch (error) {
        lowerFence(g);
        throw error;
      }
      return reload('importBoard', p, g, nextDoc);
    });
  }

  return {
    state,
    open,
    startEmpty,
    resolveRecovery,
    reportReady,
    saveRecovery,
    end,
    handoff,
    rendererGone,
    activate,
    revert,
    updateActive,
    createBoard,
    renameBoard,
    deleteBoard,
    listImportable,
    importBoard
  };
}

export default { createBoardSession, HANDOFF_MAX_AGE_MS };
