/**
 * Show Session
 *
 * Per-process state for the live session: which profile's active show is
 * open, whether the page has applied it, and whether crash-recovery writes
 * are still allowed. See docs/superpowers/specs/2026-10-17-shows-design.md.
 *
 * The profile is captured at `open()`. Every later recovery write, handoff
 * and retire uses that captured profile, never `getCurrentProfile()`, so a
 * late write from the old page can't land in a new profile mid-switch.
 *
 * `end()` is the only way out of a session. It raises a fence first, waits
 * for any recovery write already in flight, then retires. The fence stays up
 * until the next `open()`.
 *
 * Show mutations need a ready, unfenced session and run one at a time; a
 * second call while one runs is rejected as 'busy'. Each saves the show
 * document first and only then updates the session. The ones that change
 * the active show (activate, revert, deleting the active show, import)
 * raise the fence before their first await, retire, and leave the session
 * 'loading' at a new generation for the page to apply and report ready.
 *
 * `dirty` says whether the layout on screen differs from the saved active
 * show. The recovery write decides it: a write sets it, a retire as equal
 * clears it. Anything that puts the saved show on screen, or saves the
 * screen as the show, clears it; restoring a recovery record sets it.
 * Outside 'ready' it reads false: no layout on screen is the show's then.
 *
 * Played counts (per song id, for the night) live here too, persisted to
 * their own file by recoveryStore.writePlayed on every change. They belong
 * to the session, not the show: they start empty at open(), carry across
 * show changes (so a show mutation's fence doesn't stop them), never touch
 * `dirty`, and are retired by end() wherever the layout record is. A played
 * file found at open() counts as a show in progress. Until the open is
 * settled (resolveRecovery(), or an open or startEmpty with nothing pending)
 * plays are refused and a clean exit or switch keeps the file, so a failed,
 * unreadable or still-prompting open can never replace or lose a crash's counts.
 *
 * @module show-session
 */

import { ShowStoreError } from './show-store.js';
import {
  addShow,
  deleteShow as deleteFromDocument,
  importName,
  normalizeLayout,
  renameShow as renameInDocument,
  setActive,
  setShowColor as setColorInDocument,
  updateShowLayout
} from './show-document.js';

// An update or renderer-crash handoff older than this falls back to the
// normal crash prompt instead of a silent restore.
export const HANDOFF_MAX_AGE_MS = 15 * 60 * 1000;

const FAILED_CODES = new Set(['io', 'version', 'unregistered', 'shape']);
const END_REASONS = new Set(['clean-exit', 'switch', 'backup-restore', 'library-import', 'profile-deleted']);
// Exits that keep the record once it has been handed off to the next open,
// or when the show never became ready
const KEPT_AFTER_HANDOFF = new Set(['clean-exit', 'switch']);
const DEFAULT_PROFILE = 'Default User';
const SONG_ID = /^\d+$/;

function checkSongId(songId) {
  if (typeof songId !== 'string' || !SONG_ID.test(songId)) throw new Error('Invalid song id');
}

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

/** The layout without the given song ids, as the page shows a show whose songs left the library. */
function withoutSongs(layout, songIds) {
  const normalized = normalizeLayout(layout);
  if (songIds.size === 0) return normalized;
  return {
    ...normalized,
    hotkeys: normalized.hotkeys.map((tab) => ({
      ...tab,
      hotkeys: Object.fromEntries(Object.entries(tab.hotkeys).filter(([, id]) => !songIds.has(String(id))))
    })),
    holdingTank: normalized.holdingTank.map((tab) => ({
      ...tab,
      songIds: tab.songIds.filter((id) => !songIds.has(String(id)))
    }))
  };
}

/**
 * @param {Object} deps
 * @param {Object} deps.showStore - from createShowStore
 * @param {Object} deps.recoveryStore - from createRecoveryStore
 * @param {() => string[]} [deps.listProfiles] - names of every registered profile
 * @param {() => string|null} deps.getCurrentProfile
 * @param {() => void} [deps.rebuildMenu]
 * @param {() => number} [deps.now]
 * @param {() => string} [deps.newId] - id for a new show
 * @param {Object} [deps.debugLog]
 */
export function createShowSession({
  showStore,
  recoveryStore,
  listProfiles = () => [],
  getCurrentProfile,
  rebuildMenu,
  now = Date.now,
  newId,
  debugLog
}) {
  const logCtx = (fn) => ({ module: 'show-session', function: fn });

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
  // Set while a show mutation runs
  let mutating = false;
  // Song ids the page dropped, as missing from the library, when it applied
  // this generation's show. The live layout can never hold them, so the
  // equality check leaves them out of the saved layout.
  let droppedIds = new Set();
  // The layout on screen differs from the saved active show
  let dirty = false;
  // Counts the recovery saves (writes and retires) saveRecovery performs, and
  // keeps the last one's layout, so a Save can tell what is on screen once it
  // has run
  let recoveryWriteSeq = 0;
  let lastWrittenLayout = null;
  // Played counts for the night: song id -> count. `openSeq` tells a played
  // write which open() it belongs to, since counts outlive generations.
  let played = new Map();
  let openSeq = 0;
  // The played record read by open(), until resolveRecovery() settles it
  let pendingPlayed = null;
  // Whether this open's crash records are settled, so the counts are this session's
  let playedSettled = false;

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

  function activeShow() {
    return doc?.shows.find((b) => b.id === doc.activeShowId) ?? null;
  }

  function queued(task) {
    const run = writeQueue.then(task);
    writeQueue = run.catch(() => {});
    return run;
  }

  const visibleDirty = () => status === 'ready' && dirty;

  // The Shows menu's Revert item follows the visible flag, so rebuild only when it flips
  function setDirty(next) {
    const before = visibleDirty();
    dirty = next;
    if (visibleDirty() !== before) refreshMenu('setDirty');
  }

  const state = () => ({ profile, status, doc, generation, dirty: visibleDirty(), hasPlayed: played.size > 0 });

  const playedCounts = () => Object.fromEntries(played);

  async function open() {
    profile = getCurrentProfile();
    generation += 1;
    const myGeneration = generation;
    fenced = false;
    handedOff = false;
    ended = false;
    pendingHandoff = null;
    pendingRecovery = null;
    pendingPlayed = null;
    playedSettled = false;
    openSeq += 1;
    setPlayed(new Map());
    droppedIds = new Set();
    setDirty(false);
    doc = null;
    setStatus('loading');

    let loaded;
    try {
      loaded = await showStore.load(profile);
    } catch (error) {
      if (myGeneration !== generation) throw new Error('superseded by a newer open', { cause: error });
      if (error instanceof ShowStoreError && error.code === 'unreadable') {
        setStatus('unreadable');
        return { unreadable: true, generation };
      }
      setStatus('failed');
      debugLog?.error?.('Could not open the active show', { ...logCtx('open'), code: error?.code, error: error?.message });
      if (error instanceof ShowStoreError && FAILED_CODES.has(error.code)) {
        return { failed: true, error: error.code, generation };
      }
      throw error;
    }

    const record = await readRecord(profile, 'open');
    const playedRecord = await readPlayedRecord(profile, 'open');
    if (myGeneration !== generation) throw new Error('superseded by a newer open');

    doc = loaded.doc;
    pendingRecovery = record;
    pendingPlayed = playedRecord;
    playedSettled = !record && !playedRecord;
    const show = activeShow();
    const result = {
      doc,
      show: { ...show, layout: normalizeLayout(show.layout) },
      recovery: recoveryInfo(record, playedRecord),
      generation
    };
    if (loaded.notice) result.notice = loaded.notice;
    return result;
  }

  async function readRecord(p, fn) {
    try {
      return await recoveryStore.read(p);
    } catch (error) {
      // A recovery record that can't be read is treated as no record
      debugLog?.warn?.('Could not read the recovery record', { ...logCtx(fn), error: error.message });
      return null;
    }
  }

  async function readPlayedRecord(p, fn) {
    try {
      return (await recoveryStore.readPlayed?.(p)) ?? null;
    } catch (error) {
      debugLog?.warn?.('Could not read the played counts', { ...logCtx(fn), error: error.message });
      return null;
    }
  }

  /**
   * What the page needs to know about a show in progress, or null without
   * one: a layout record, a played file, or both. The layout record's
   * handoff decides when there is one; the time is the later of the two.
   */
  function recoveryInfo(record, playedRecord = null) {
    const source = record ?? playedRecord;
    if (!source) return null;
    // Measured from the handoff: a crash long after the last edit is still fresh
    const fresh = now() - (source.handoffAt ?? source.savedAt) <= HANDOFF_MAX_AGE_MS;
    return {
      savedAt: Math.max(record?.savedAt ?? -Infinity, playedRecord?.savedAt ?? -Infinity),
      handoff: source.handoff && fresh ? source.handoff : null,
      showId: record?.showId ?? null
    };
  }

  // The Shows menu's Mark All Songs as Unplayed item follows whether any count is set
  function setPlayed(next) {
    const before = played.size > 0;
    played = next;
    if ((played.size > 0) !== before) refreshMenu('setPlayed');
  }

  async function startEmpty() {
    if (status !== 'unreadable') throw new Error('startEmpty is only allowed when the shows are unreadable');
    const p = profile;
    const g = generation;
    const { doc: emptyDoc } = await showStore.resetUnreadable(p);
    if (generation !== g) throw new Error('superseded by a newer open');
    // The show in progress is offered on the empty show, as after open()
    const record = await readRecord(p, 'startEmpty');
    const playedRecord = await readPlayedRecord(p, 'startEmpty');
    if (generation !== g) throw new Error('superseded by a newer open');
    doc = emptyDoc;
    pendingRecovery = record;
    pendingPlayed = playedRecord;
    // Without a record the page applies the empty show without resolving
    playedSettled = !record && !playedRecord;
    setDirty(false);
    setStatus('loading');
    return { layout: normalizeLayout(activeShow().layout), generation, recovery: recoveryInfo(record, playedRecord) };
  }

  async function resolveRecovery(choice) {
    if (choice !== 'restore' && choice !== 'discard') throw new Error(`Invalid recovery choice: ${String(choice)}`);
    if (!doc) throw new Error('No show is open');
    const p = profile;
    const record = pendingRecovery;
    const playedRecord = pendingPlayed;
    pendingRecovery = null;
    pendingPlayed = null;
    playedSettled = true;
    const saved = normalizeLayout(activeShow().layout);
    if (!record && !playedRecord) return { layout: saved, counts: playedCounts() };
    // Restored onto the active show, whatever showId the record names.
    // A handoff is spent once restored: another crash before any edit must ask.
    if (choice === 'restore') {
      // The restored layout is the recovery copy, not the saved show
      if (record) setDirty(true);
      if (playedRecord) setPlayed(new Map(Object.entries(playedRecord.counts)));
      if (record?.handoff) await queued(() => recoveryStore.clearHandoff(p));
      if (playedRecord?.handoff) await queued(() => recoveryStore.writePlayed(p, playedCounts()));
      return { layout: record ? normalizeLayout(record.layout) : saved, counts: playedCounts() };
    }
    setDirty(false);
    setPlayed(new Map());
    // Set aside, not deleted: a wrong answer at the prompt stays recoverable
    await queued(() => recoveryStore.discard(p));
    return { layout: saved, counts: {} };
  }

  /**
   * @param {number} reportedGeneration
   * @param {boolean} ok
   * @param {{ droppedIds?: string[] }} [details] - song ids the page dropped as missing from the library
   */
  function reportReady(reportedGeneration, ok, { droppedIds: dropped = [] } = {}) {
    // A failed open() already set 'failed'; the page's failed report confirms it
    if (!ok && reportedGeneration === generation && status === 'failed') return;
    if (reportedGeneration !== generation || status !== 'loading') {
      debugLog?.info?.('Ignoring stale show ready report', { ...logCtx('reportReady'), reportedGeneration, generation, status });
      return;
    }
    droppedIds = new Set(ok ? dropped.map(String) : []);
    setStatus(ok ? 'ready' : 'failed');
  }

  /** Whether a layout is the saved active show, as the page shows it. */
  function matchesSaved(layout) {
    return layoutKey(layout) === layoutKey(withoutSongs(activeShow().layout, droppedIds));
  }

  const refused = (myGeneration) => status !== 'ready' || fenced || myGeneration !== generation;

  // Every outcome reports `dirty`; a skipped save leaves it as it was. A
  // failed write or retire still sets it, since it says what is on screen.
  function saveRecovery(layout) {
    const myGeneration = generation;
    const p = profile;
    if (refused(myGeneration)) return Promise.resolve({ skipped: true, dirty: visibleDirty() });
    const normalized = normalizeLayout(layout);
    return queued(async () => {
      // Re-checked here: end() may have fenced while this waited its turn
      if (refused(myGeneration)) return { skipped: true, dirty: visibleDirty() };
      const show = activeShow();
      const equal = matchesSaved(normalized);
      recoveryWriteSeq += 1;
      lastWrittenLayout = normalized;
      // Set before the await: a newer generation, which sets its own, can't
      // have started yet, and a failed write or retire must not leave it stale
      if (myGeneration === generation) setDirty(!equal);
      if (equal) {
        await recoveryStore.retire(p);
      } else {
        await recoveryStore.write(p, { showId: show.id, layout: normalized });
      }
      return equal ? { retired: true, dirty: visibleDirty() } : { dirty: visibleDirty() };
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
    // A show that never became ready (crash prompt still open, failed or
    // unreadable open) never replaced the record, so quitting or switching
    // must leave it for the next open
    const neverReady = status !== 'ready';
    const kept = (handedOff || neverReady) && KEPT_AFTER_HANDOFF.has(reason);
    // The counts are kept only when handed off or never settled (a prompt
    // still open, a failed or unreadable open): a quit while a show change
    // loads has nothing to restore
    const keptPlayed = (handedOff || !playedSettled) && KEPT_AFTER_HANDOFF.has(reason);
    const handoffDone = pendingHandoff;
    ended = true;
    fenced = true;
    if (handoffDone) await handoffDone;
    await writeQueue;
    // A library import clears every record itself, once it has committed: one
    // that fails after this fence reloads the page, and the show in progress
    // must still be there
    if (reason !== 'library-import') {
      if (!kept) await recoveryStore.retire(p);
      if (!keptPlayed) await recoveryStore.retirePlayed(p);
    }
    if (generation === g) {
      pendingRecovery = null;
      pendingPlayed = null;
      setPlayed(new Map());
      setStatus('idle');
    }
  }

  async function handoff(reason) {
    if (!profile || ended) return;
    const p = profile;
    fenced = true;
    handedOff = true;
    // The counts are this session's once any played file at open is settled,
    // whatever show is loading; the next open restores them silently
    const markPlayed = playedSettled && played.size > 0;
    // Before ready the record isn't this session's: it's an earlier crash
    // still waiting at the prompt, and the never-ready rule keeps it as is
    const markLayout = status === 'ready';
    if (!markPlayed && !markLayout) return;
    // Queued, so a mutation's retire can't land between its read and write
    // and have the old record written back
    await queued(async () => {
      if (markLayout) await recoveryStore.markHandoff(p, reason);
      if (markPlayed) await recoveryStore.writePlayed(p, playedCounts(), { handoff: reason });
    });
  }

  function rendererGone() {
    if (!profile || ended) return Promise.resolve();
    // handoff() captures the profile before its first await
    pendingHandoff = handoff('renderer-crash').catch((error) => {
      debugLog?.error?.('Could not mark the recovery record after a renderer crash', {
        ...logCtx('rendererGone'),
        error: error.message
      });
    });
    return pendingHandoff;
  }

  // --- Played counts ---

  // Refused once the session has ended or handed off, and until the open is
  // settled: while a crash record waits at the prompt, or the open failed
  const playedRefused = () => !profile || ended || handedOff || !playedSettled;

  /** Write the counts as they are now, for the open() they were recorded in. */
  function persistPlayed(fn) {
    const p = profile;
    const mySeq = openSeq;
    return queued(async () => {
      // Re-checked here: end() or a handoff may have run while this waited its turn
      if (mySeq !== openSeq || playedRefused()) return false;
      await recoveryStore.writePlayed(p, playedCounts());
      return true;
    }).catch((error) => {
      debugLog?.warn?.('Could not save the played counts', { ...logCtx(fn), error: error.message });
      return false;
    });
  }

  /** One more play of a song, counted when its playback started. */
  async function recordPlay(songId) {
    checkSongId(songId);
    if (playedRefused()) return { skipped: true };
    const next = new Map(played);
    next.set(songId, (next.get(songId) ?? 0) + 1);
    setPlayed(next);
    await persistPlayed('recordPlay');
    return { count: next.get(songId) };
  }

  /** Clear one song's count, or every count with null. */
  async function clearPlayed(songId) {
    if (songId !== null) checkSongId(songId);
    if (playedRefused()) return { skipped: true };
    const next = new Map(songId === null ? [] : played);
    next.delete(songId);
    setPlayed(next);
    await persistPlayed('clearPlayed');
    return { count: 0 };
  }

  // --- Show mutations ---

  const idOptions = () => (newId ? { newId } : {});

  /**
   * Run one show mutation. The task gets the profile, generation and doc
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

  // The show is already saved by now, so a failed retire is only logged:
  // the next recovery write replaces the stale record
  async function retireRecovery(fn, p) {
    try {
      await queued(() => recoveryStore.retire(p));
    } catch (error) {
      debugLog?.warn?.('Could not retire the recovery record', { ...logCtx(fn), error: error.message });
    }
  }

  /**
   * Save a document that keeps the active show, then adopt it. With
   * `writeSeq` (captured before the first await), the screen was saved as
   * the show, so the recovery record is retired and dirty cleared, unless a
   * recovery save of a different layout landed while the save ran. Then the
   * screen still differs from the new show: dirty stays set and the record
   * holds that layout, written back if it was retired as equal to the old show.
   */
  async function saveInPlace(fn, p, g, nextDoc, { writeSeq = null } = {}) {
    await showStore.save(p, nextDoc);
    assertCurrent(g);
    doc = nextDoc;
    if (writeSeq === null) return;
    try {
      await queued(async () => {
        if (generation !== g) return;
        const movedOn = recoveryWriteSeq !== writeSeq && !matchesSaved(lastWrittenLayout);
        setDirty(movedOn);
        if (!movedOn) {
          // The layout on screen is now the saved show
          await recoveryStore.retire(p);
        } else if (!fenced) {
          await recoveryStore.write(p, { showId: activeShow().id, layout: lastWrittenLayout });
        }
      });
    } catch (error) {
      // The show is already saved; the next recovery write replaces the stale record
      debugLog?.warn?.('Could not retire or update the recovery record', { ...logCtx(fn), error: error.message });
    }
  }

  /**
   * Finish a mutation that changes the show on screen. The caller has
   * already raised the fence. Saves `nextDoc` (none for a revert), retires,
   * then starts a new generation in 'loading'.
   */
  async function reload(fn, p, g, nextDoc) {
    try {
      if (nextDoc) await showStore.save(p, nextDoc);
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
    setDirty(false);
    // Writes stay refused while loading, by status and by generation
    if (!handedOff) fenced = false;
    setStatus('loading');
    return { layout: normalizeLayout(activeShow().layout), generation };
  }

  function activate(showId) {
    return mutation('activate', ({ p, g, d }) => {
      if (showId === d.activeShowId) throw new Error('already active');
      const nextDoc = setActive(d, showId);
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
      const writeSeq = recoveryWriteSeq;
      const nextDoc = updateShowLayout(d, d.activeShowId, normalizeLayout(layout), now());
      await saveInPlace('updateActive', p, g, nextDoc, { writeSeq });
    });
  }

  function createShow(name, layout) {
    return mutation('createShow', async ({ p, g, d }) => {
      const writeSeq = recoveryWriteSeq;
      // Save As carries the current show's color to the copy
      const { doc: nextDoc, show } = addShow(d, {
        name,
        layout: normalizeLayout(layout),
        color: d.shows.find((b) => b.id === d.activeShowId)?.color ?? null,
        now: now(),
        ...idOptions()
      });
      await saveInPlace('createShow', p, g, nextDoc, { writeSeq });
      return { id: show.id, name: show.name };
    });
  }

  function renameShow(showId, name) {
    return mutation('renameShow', async ({ p, g, d }) => {
      const nextDoc = renameInDocument(d, showId, name, now());
      await saveInPlace('renameShow', p, g, nextDoc);
      const renamed = nextDoc.shows.find((b) => b.id === showId);
      return { id: renamed.id, name: renamed.name };
    });
  }

  // A show property, like the name: saved at once, layout and dirty untouched
  function setShowColor(showId, color) {
    return mutation('setShowColor', async ({ p, g, d }) => {
      const nextDoc = setColorInDocument(d, showId, color, now());
      await saveInPlace('setShowColor', p, g, nextDoc);
      return { id: showId, color };
    });
  }

  function deleteShow(showId) {
    return mutation('deleteShow', async ({ p, g, d }) => {
      const { doc: nextDoc, activeChanged } = deleteFromDocument(d, showId, { now: now(), ...idOptions() });
      if (!activeChanged) {
        await saveInPlace('deleteShow', p, g, nextDoc);
        return { activeChanged: false };
      }
      fenced = true;
      return { activeChanged: true, ...(await reload('deleteShow', p, g, nextDoc)) };
    });
  }

  /** Every other registered profile's shows, read without writing. */
  async function listImportable() {
    const p = profile;
    if (!p) throw new Error('No profile is open');
    const names = listProfiles().filter((name) => name !== p).sort(compareProfiles);
    const result = [];
    for (const name of names) {
      let peeked = null;
      try {
        peeked = await showStore.peek(name);
      } catch (error) {
        debugLog?.warn?.('Could not read another profile\'s shows', { ...logCtx('listImportable'), error: error.message });
      }
      if (!peeked) continue;
      result.push({
        profile: name,
        shows: peeked.shows.map(({ id, name: showName, updatedAt }) => ({ id, name: showName, updatedAt }))
      });
    }
    return result;
  }

  function importShow(sourceProfile, showId) {
    return mutation('importShow', async ({ p, g, d }) => {
      if (typeof sourceProfile !== 'string' || !listProfiles().includes(sourceProfile)) {
        throw new Error(`Profile "${String(sourceProfile)}" is not registered`);
      }
      if (sourceProfile === p) throw new Error('Cannot import from the current profile');
      fenced = true;
      let nextDoc;
      try {
        // peek never writes the source profile's files
        const source = (await showStore.peek(sourceProfile))?.shows.find((b) => b.id === showId);
        if (!source) throw new Error('Show not found.');
        assertCurrent(g);
        const at = now();
        nextDoc = addShow(d, {
          name: importName(d, source.name, sourceProfile),
          layout: source.layout,
          color: source.color,
          now: at,
          ...idOptions(),
          importedFrom: { profile: sourceProfile, showId, showName: source.name, at }
        }).doc;
      } catch (error) {
        lowerFence(g);
        throw error;
      }
      return reload('importShow', p, g, nextDoc);
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
    recordPlay,
    clearPlayed,
    activate,
    revert,
    updateActive,
    createShow,
    renameShow,
    setShowColor,
    deleteShow,
    listImportable,
    importShow
  };
}

export default { createShowSession, HANDOFF_MAX_AGE_MS };
