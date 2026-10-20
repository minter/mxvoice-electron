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
 * @module board-session
 */

import { BoardStoreError } from './board-store.js';
import { normalizeLayout } from './board-document.js';

// An update or renderer-crash handoff older than this falls back to the
// normal crash prompt instead of a silent restore.
export const HANDOFF_MAX_AGE_MS = 15 * 60 * 1000;

const FAILED_CODES = new Set(['io', 'version', 'unregistered', 'shape']);
const END_REASONS = new Set(['clean-exit', 'switch', 'backup-restore', 'library-import', 'profile-deleted']);
// Exits that keep the record once it has been handed off to the next open
const KEPT_AFTER_HANDOFF = new Set(['clean-exit', 'switch']);

/** Stable comparison of two layouts, ignoring the selected tabs. */
function layoutKey(layout) {
  const { selected: _selected, ...rest } = normalizeLayout(layout);
  return JSON.stringify(rest);
}

/**
 * @param {Object} deps
 * @param {Object} deps.boardStore - from createBoardStore
 * @param {Object} deps.recoveryStore - from createRecoveryStore
 * @param {Object} [deps.profileManager] - used by board mutations
 * @param {() => string|null} deps.getCurrentProfile
 * @param {() => void} [deps.rebuildMenu]
 * @param {() => number} [deps.now]
 * @param {() => string} [deps.newId] - used by board mutations
 * @param {Object} [deps.debugLog]
 */
export function createBoardSession({
  boardStore,
  recoveryStore,
  getCurrentProfile,
  rebuildMenu,
  now = Date.now,
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

  function setStatus(next) {
    if (status === next) return;
    status = next;
    try {
      rebuildMenu?.();
    } catch (error) {
      debugLog?.warn?.('Menu rebuild failed', { ...logCtx('setStatus'), error: error.message });
    }
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
    // Restored onto the active board, whatever boardId the record names
    if (choice === 'restore') return { layout: normalizeLayout(record.layout) };
    await queued(() => recoveryStore.retire(p));
    return { layout: saved };
  }

  function reportReady(reportedGeneration, ok) {
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
    const kept = handedOff && KEPT_AFTER_HANDOFF.has(reason);
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
    await writeQueue;
    await recoveryStore.markHandoff(p, reason);
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

  return { state, open, startEmpty, resolveRecovery, reportReady, saveRecovery, end, handoff, rendererGone };
}

export default { createBoardSession, HANDOFF_MAX_AGE_MS };
