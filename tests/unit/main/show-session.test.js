import { afterEach, describe, expect, it, vi } from 'vitest';
import nodeFs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createShowSession } from '../../../src/main/modules/show-session.js';
import { ShowStoreError, createShowStore } from '../../../src/main/modules/show-store.js';
import { addShow, createDocument, normalizeLayout } from '../../../src/main/modules/show-document.js';

const MINUTE = 60 * 1000;
const T0 = 1_000_000_000_000;

function layoutWith(n) {
  const songId = String(n);
  return normalizeLayout({
    hotkeys: [{ tabNumber: 1, hotkeys: { f1: songId } }],
    holdingTank: [{ tabNumber: 1, songIds: [songId] }],
  });
}

function makeDoc(layout = layoutWith(1)) {
  let n = 0;
  return createDocument(layout, { now: T0, newId: () => `show-${++n}` });
}

/** In-memory recovery store with the real store's contract. */
function fakeRecoveryStore(clock) {
  const records = new Map();
  const played = new Map();
  const discarded = new Map();
  const calls = [];
  return {
    records,
    calls,
    write: vi.fn(async (profile, { showId, layout }) => {
      calls.push(['write', profile]);
      records.set(profile, { version: 1, showId, savedAt: clock.now(), handoff: null, layout });
    }),
    read: vi.fn(async (profile) => records.get(profile) ?? null),
    markHandoff: vi.fn(async (profile, reason) => {
      calls.push(['markHandoff', profile, reason]);
      const record = records.get(profile);
      if (!record) return false;
      records.set(profile, { ...record, handoff: reason, handoffAt: clock.now() });
      return true;
    }),
    clearHandoff: vi.fn(async (profile) => {
      calls.push(['clearHandoff', profile]);
      const record = records.get(profile);
      if (!record) return false;
      const { handoffAt: _handoffAt, ...rest } = record;
      records.set(profile, { ...rest, handoff: null });
      return true;
    }),
    retire: vi.fn(async (profile) => {
      calls.push(['retire', profile]);
      records.delete(profile);
    }),
    clearAll: vi.fn(async () => {
      calls.push(['clearAll']);
      records.clear();
      played.clear();
    }),
    // Played counts: their own file, so their calls are kept apart from `calls`
    played,
    writePlayed: vi.fn(async (profile, counts, { handoff = null } = {}) => {
      if (Object.keys(counts).length === 0) {
        played.delete(profile);
        return;
      }
      played.set(profile, {
        version: 1, savedAt: clock.now(), handoff, ...(handoff ? { handoffAt: clock.now() } : {}), counts: { ...counts },
      });
    }),
    readPlayed: vi.fn(async (profile) => played.get(profile) ?? null),
    retirePlayed: vi.fn(async (profile) => { played.delete(profile); }),
    // Soft discard: both files are set aside, never read back
    discarded,
    discard: vi.fn(async (profile) => {
      calls.push(['discard', profile]);
      discarded.set(profile, { record: records.get(profile) ?? null, played: played.get(profile) ?? null });
      records.delete(profile);
      played.delete(profile);
    }),
  };
}

function setup({ doc = makeDoc(), loadError = null, profile = 'Alice', profiles = ['Alice'], showStore: realStore } = {}) {
  const clock = { t: T0, now: () => clock.t };
  const current = { profile };
  const recoveryStore = fakeRecoveryStore(clock);
  const showStore = realStore ?? {
    load: vi.fn(async () => {
      if (loadError) throw loadError;
      return { doc, source: 'shows' };
    }),
    resetUnreadable: vi.fn(async () => ({ doc: makeDoc(normalizeLayout(null)) })),
    peek: vi.fn(),
    save: vi.fn(),
  };
  const rebuildMenu = vi.fn();
  const debugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  let idCount = 0;
  const session = createShowSession({
    showStore,
    recoveryStore,
    listProfiles: () => profiles,
    getCurrentProfile: () => current.profile,
    rebuildMenu,
    now: clock.now,
    newId: () => (++idCount === 1 ? 'new-id' : `new-id-${idCount}`),
    debugLog,
  });
  return { session, showStore, recoveryStore, rebuildMenu, clock, current, doc, debugLog };
}

async function openReady(ctx) {
  const opened = await ctx.session.open();
  ctx.session.reportReady(opened.generation, true);
  return opened;
}

describe('show session', () => {
  it('open loads the active show and reports recovery when a record exists', async () => {
    const ctx = setup();
    const showId = ctx.doc.activeShowId;
    ctx.recoveryStore.records.set('Alice', {
      version: 1, showId, savedAt: T0 - MINUTE, handoff: null, layout: layoutWith(7),
    });

    const opened = await ctx.session.open();

    expect(ctx.showStore.load).toHaveBeenCalledWith('Alice');
    expect(opened.doc).toBe(ctx.doc);
    expect(opened.show.id).toBe(showId);
    expect(opened.show.layout).toEqual(layoutWith(1));
    expect(opened.recovery).toEqual({ savedAt: T0 - MINUTE, handoff: null, showId });
    expect(opened.generation).toBe(1);
    expect(ctx.session.state()).toMatchObject({ profile: 'Alice', status: 'loading', generation: 1 });
    expect(ctx.rebuildMenu).toHaveBeenCalled();

    // Without a record, recovery is null
    ctx.recoveryStore.records.clear();
    const again = await ctx.session.open();
    expect(again.recovery).toBeNull();
    expect(again.generation).toBe(2);

    // state() is a copy
    const snapshot = ctx.session.state();
    snapshot.status = 'ready';
    expect(ctx.session.state().status).toBe('loading');
  });

  it('open with a fresh "update" handoff returns it; one older than 15 minutes is dropped', async () => {
    const ctx = setup();
    const showId = ctx.doc.activeShowId;
    const record = { version: 1, showId, handoff: 'update', layout: layoutWith(7) };

    ctx.recoveryStore.records.set('Alice', { ...record, savedAt: T0 - 14 * MINUTE });
    expect((await ctx.session.open()).recovery).toEqual({
      savedAt: T0 - 14 * MINUTE, handoff: 'update', showId,
    });

    ctx.recoveryStore.records.set('Alice', { ...record, savedAt: T0 - 16 * MINUTE });
    expect((await ctx.session.open()).recovery).toEqual({
      savedAt: T0 - 16 * MINUTE, handoff: null, showId,
    });
  });

  it('saveRecovery is refused while loading, failed or fenced', async () => {
    const ctx = setup();
    const opened = await ctx.session.open();
    await expect(ctx.session.saveRecovery(layoutWith(9))).resolves.toMatchObject({ skipped: true });

    ctx.session.reportReady(opened.generation, false);
    expect(ctx.session.state().status).toBe('failed');
    await expect(ctx.session.saveRecovery(layoutWith(9))).resolves.toMatchObject({ skipped: true });

    await openReady(ctx);
    await ctx.session.handoff('update');
    await expect(ctx.session.saveRecovery(layoutWith(9))).resolves.toMatchObject({ skipped: true });
    expect(ctx.recoveryStore.write).not.toHaveBeenCalled();

    // A ready, unfenced session writes
    await openReady(ctx);
    await expect(ctx.session.saveRecovery(layoutWith(9))).resolves.toEqual({ dirty: true });
    expect(ctx.recoveryStore.records.get('Alice')).toMatchObject({
      showId: ctx.doc.activeShowId,
      layout: layoutWith(9),
    });
  });

  it('saveRecovery of a layout equal to the saved show retires instead of writing', async () => {
    const ctx = setup();
    await openReady(ctx);
    ctx.recoveryStore.records.set('Alice', { version: 1, showId: 'x', savedAt: T0, handoff: null, layout: layoutWith(5) });

    const sameButSelected = { ...layoutWith(1), selected: { hotkeyTab: 3, holdingTankTab: 2 } };
    await expect(ctx.session.saveRecovery(sameButSelected)).resolves.toEqual({ retired: true, dirty: false });

    expect(ctx.recoveryStore.write).not.toHaveBeenCalled();
    expect(ctx.recoveryStore.retire).toHaveBeenCalledWith('Alice');
    expect(ctx.recoveryStore.records.has('Alice')).toBe(false);
  });

  it('a no-op save after a show loaded with missing songs retires instead of writing', async () => {
    // The saved show names song 2, which was deleted from the library
    const saved = normalizeLayout({
      hotkeys: [{ tabNumber: 1, hotkeys: { f1: '1', f2: '2' } }],
      holdingTank: [{ tabNumber: 1, songIds: ['2', '1'] }],
    });
    const ctx = setup({ doc: makeDoc(saved) });
    const opened = await ctx.session.open();
    ctx.session.reportReady(opened.generation, true, { droppedIds: ['2'] });
    ctx.recoveryStore.records.set('Alice', { version: 1, showId: 'x', savedAt: T0, handoff: null, layout: layoutWith(5) });

    // What the page shows: the show without song 2
    await expect(ctx.session.saveRecovery(layoutWith(1))).resolves.toEqual({ retired: true, dirty: false });
    expect(ctx.recoveryStore.write).not.toHaveBeenCalled();
    expect(ctx.recoveryStore.records.has('Alice')).toBe(false);

    // A real edit still writes
    await expect(ctx.session.saveRecovery(layoutWith(9))).resolves.toEqual({ dirty: true });

    // The next open starts without the old dropped ids
    const again = await ctx.session.open();
    ctx.session.reportReady(again.generation, true);
    await expect(ctx.session.saveRecovery(layoutWith(1))).resolves.toEqual({ dirty: true });
  });

  it('recovery writes go to the profile captured at open, even after getCurrentProfile changes', async () => {
    const ctx = setup();
    await openReady(ctx);
    ctx.current.profile = 'Bob';

    await ctx.session.saveRecovery(layoutWith(9));
    expect(ctx.recoveryStore.write).toHaveBeenCalledWith('Alice', {
      showId: ctx.doc.activeShowId,
      layout: layoutWith(9),
    });

    await ctx.session.end('switch');
    expect(ctx.recoveryStore.retire).toHaveBeenCalledWith('Alice');
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalledWith('Bob');
  });

  it('reportReady with a stale generation is ignored', async () => {
    const ctx = setup();
    const first = await ctx.session.open();
    const second = await ctx.session.open();
    ctx.rebuildMenu.mockClear();

    ctx.session.reportReady(first.generation, true);
    expect(ctx.session.state().status).toBe('loading');
    expect(ctx.rebuildMenu).not.toHaveBeenCalled();

    ctx.session.reportReady(second.generation, true);
    expect(ctx.session.state().status).toBe('ready');
    expect(ctx.rebuildMenu).toHaveBeenCalledTimes(1);
  });

  it('rebuilds the menu when the visible dirty flag flips, not on a dirty-to-dirty write', async () => {
    const ctx = setup();
    await openReady(ctx);
    ctx.rebuildMenu.mockClear();

    await ctx.session.saveRecovery(layoutWith(9));
    expect(ctx.session.state().dirty).toBe(true);
    expect(ctx.rebuildMenu).toHaveBeenCalledTimes(1);

    await ctx.session.saveRecovery(layoutWith(8));
    expect(ctx.rebuildMenu).toHaveBeenCalledTimes(1);

    await ctx.session.saveRecovery(layoutWith(1));
    expect(ctx.session.state().dirty).toBe(false);
    expect(ctx.rebuildMenu).toHaveBeenCalledTimes(2);
  });

  it('end() fences before it retires, so a late saveRecovery cannot recreate the record', async () => {
    const ctx = setup();
    await openReady(ctx);

    // A write already in flight when end() starts must land before the retire
    let releaseWrite;
    ctx.recoveryStore.write.mockImplementationOnce(async (profile, { showId, layout }) => {
      await new Promise((resolve) => { releaseWrite = resolve; });
      ctx.recoveryStore.calls.push(['write', profile]);
      ctx.recoveryStore.records.set(profile, { version: 1, showId, savedAt: T0, handoff: null, layout });
    });
    const inFlight = ctx.session.saveRecovery(layoutWith(8));
    await vi.waitFor(() => expect(releaseWrite).toBeTypeOf('function'));
    const ending = ctx.session.end('clean-exit');
    const late = ctx.session.saveRecovery(layoutWith(9));
    await Promise.resolve();
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalled();
    releaseWrite();
    await Promise.all([inFlight, ending]);

    await expect(late).resolves.toMatchObject({ skipped: true });
    await expect(ctx.session.saveRecovery(layoutWith(10))).resolves.toMatchObject({ skipped: true });
    expect(ctx.recoveryStore.calls).toEqual([['write', 'Alice'], ['retire', 'Alice']]);
    expect(ctx.recoveryStore.records.has('Alice')).toBe(false);
    expect(ctx.session.state().status).toBe('idle');

    // end() is idempotent: once ended, end() and handoff() touch no store
    await ctx.session.end('clean-exit');
    await ctx.session.end('backup-restore');
    await ctx.session.handoff('update');
    ctx.session.rendererGone();
    await Promise.resolve();
    expect(ctx.recoveryStore.calls).toEqual([['write', 'Alice'], ['retire', 'Alice']]);

    // ...and a no-op before any open
    const idle = setup();
    await idle.session.end('clean-exit');
    await idle.session.handoff('update');
    expect(idle.recoveryStore.calls).toEqual([]);
  });

  it('end("library-import") clears every record', async () => {
    const ctx = setup();
    await openReady(ctx);
    ctx.recoveryStore.records.set('Alice', { version: 1 });
    ctx.recoveryStore.records.set('Bob', { version: 1 });

    await ctx.session.end('library-import');

    expect(ctx.recoveryStore.clearAll).toHaveBeenCalled();
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalled();
    expect(ctx.recoveryStore.records.size).toBe(0);
  });

  it('after rendererGone, end("clean-exit") keeps the record', async () => {
    const ctx = setup();
    await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));

    ctx.session.rendererGone();
    await ctx.session.end('clean-exit');

    expect(ctx.recoveryStore.markHandoff).toHaveBeenCalledWith('Alice', 'renderer-crash');
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalled();
    expect(ctx.recoveryStore.records.get('Alice')).toMatchObject({ handoff: 'renderer-crash', layout: layoutWith(9) });

    // switch keeps it too; other exits still retire it
    for (const [reason, retired] of [['switch', false], ['backup-restore', true], ['profile-deleted', true]]) {
      const other = setup();
      await openReady(other);
      await other.session.saveRecovery(layoutWith(9));
      other.session.rendererGone();
      await other.session.end(reason);
      expect(other.recoveryStore.records.has('Alice'), reason).toBe(!retired);
    }
  });

  it('rendererGone returns a promise that resolves after markHandoff', async () => {
    const ctx = setup();
    await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));

    const pending = ctx.session.rendererGone();
    expect(pending).toBeInstanceOf(Promise);
    await pending;
    expect(ctx.recoveryStore.records.get('Alice')).toMatchObject({ handoff: 'renderer-crash' });

    // A no-op still returns a resolved promise
    const idle = setup();
    await expect(idle.session.rendererGone()).resolves.toBeUndefined();
  });

  it('a renderer crash long after the last edit still restores silently on reopen', async () => {
    const ctx = setup();
    await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));
    const showId = ctx.doc.activeShowId;

    // The operator stops editing; the renderer crashes 20 minutes later
    ctx.clock.t = T0 + 20 * MINUTE;
    ctx.session.rendererGone();
    await ctx.session.end('clean-exit');

    ctx.clock.t = T0 + 21 * MINUTE;
    const reopened = await ctx.session.open();
    expect(reopened.recovery).toEqual({ savedAt: T0, handoff: 'renderer-crash', showId });

    // The window is measured from the handoff, not the edit
    ctx.clock.t = T0 + 36 * MINUTE;
    expect((await ctx.session.open()).recovery.handoff).toBeNull();
  });

  it('a renderer crash while the startup crash prompt is open does not hand off the old record', async () => {
    const ctx = setup();
    const record = { version: 1, showId: 'show-1', savedAt: T0 - MINUTE, handoff: null, layout: layoutWith(9) };
    ctx.recoveryStore.records.set('Alice', record);
    const opened = await ctx.session.open();
    expect(opened.recovery.handoff).toBeNull();
    expect(ctx.session.state().status).toBe('loading');

    ctx.session.rendererGone();
    await ctx.session.end('clean-exit');

    expect(ctx.recoveryStore.markHandoff).not.toHaveBeenCalled();
    expect(ctx.recoveryStore.records.get('Alice')).toEqual(record);
    // Still fenced: no write lands from the crashed page
    await expect(ctx.session.saveRecovery(layoutWith(5))).resolves.toMatchObject({ skipped: true });
    // The reload prompts again
    expect((await ctx.session.open()).recovery).toEqual({ savedAt: T0 - MINUTE, handoff: null, showId: 'show-1' });
  });

  it('handoff before ready fences without marking the record', async () => {
    const ctx = setup();
    ctx.recoveryStore.records.set('Alice', { version: 1, showId: 'show-1', savedAt: T0, handoff: null, layout: layoutWith(9) });
    const opened = await ctx.session.open();
    await ctx.session.handoff('update');
    expect(ctx.recoveryStore.markHandoff).not.toHaveBeenCalled();
    // A late ready report can't reopen writes: the fence is up
    ctx.session.reportReady(opened.generation, true);
    await expect(ctx.session.saveRecovery(layoutWith(5))).resolves.toMatchObject({ skipped: true });
  });

  it('an open() during end() keeps its own profile and status', async () => {
    const ctx = setup();
    await openReady(ctx);
    let releaseWrite;
    ctx.recoveryStore.write.mockImplementationOnce(async (profile) => {
      await new Promise((resolve) => { releaseWrite = resolve; });
      ctx.recoveryStore.calls.push(['write', profile]);
    });
    const inFlight = ctx.session.saveRecovery(layoutWith(8));
    await vi.waitFor(() => expect(releaseWrite).toBeTypeOf('function'));

    const ending = ctx.session.end('switch');
    ctx.current.profile = 'Bob';
    const opening = ctx.session.open();
    releaseWrite();
    await Promise.all([inFlight, ending]);
    const opened = await opening;

    expect(ctx.recoveryStore.retire).toHaveBeenCalledWith('Alice');
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalledWith('Bob');
    expect(ctx.session.state()).toMatchObject({ profile: 'Bob', status: 'loading', generation: opened.generation });
    ctx.session.reportReady(opened.generation, true);
    expect(ctx.session.state().status).toBe('ready');
    await expect(ctx.session.saveRecovery(layoutWith(9))).resolves.toEqual({ dirty: true });
    expect(ctx.recoveryStore.write).toHaveBeenLastCalledWith('Bob', expect.anything());
  });

  it('a renderer-crash handoff marks the profile it was called for, even across an open()', async () => {
    const ctx = setup();
    await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));
    let release;
    const marked = [];
    ctx.recoveryStore.markHandoff.mockImplementationOnce(async (profile, reason) => {
      await new Promise((resolve) => { release = resolve; });
      marked.push([profile, reason]);
    });

    ctx.session.rendererGone();
    ctx.current.profile = 'Bob';
    const opened = await ctx.session.open();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    release();
    await vi.waitFor(() => expect(marked).toEqual([['Alice', 'renderer-crash']]));

    expect(ctx.recoveryStore.markHandoff).not.toHaveBeenCalledWith('Bob', expect.anything());
    ctx.session.reportReady(opened.generation, true);
    expect(ctx.session.state()).toMatchObject({ profile: 'Bob', status: 'ready' });
    // Bob's session was not handed off, so its clean exit retires Bob only
    await ctx.session.end('clean-exit');
    expect(ctx.recoveryStore.retire).toHaveBeenCalledWith('Bob');
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalledWith('Alice');
  });

  it('an unreadable recovery record opens as no recovery', async () => {
    const ctx = setup();
    ctx.recoveryStore.read.mockRejectedValueOnce(new Error('EACCES'));
    const opened = await ctx.session.open();
    expect(opened.recovery).toBeNull();
    expect(ctx.session.state().doc).toBe(ctx.doc);
  });

  it('startEmpty superseded by a newer open does not touch the new session', async () => {
    const ctx = setup({ loadError: new ShowStoreError('unreadable') });
    await ctx.session.open();
    let release;
    ctx.showStore.resetUnreadable.mockImplementationOnce(async () => {
      await new Promise((resolve) => { release = resolve; });
      return { doc: makeDoc(normalizeLayout(null)) };
    });
    const empty = ctx.session.startEmpty();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    await ctx.session.open();
    release();
    await expect(empty).rejects.toThrow('superseded');
    expect(ctx.session.state()).toMatchObject({ status: 'unreadable', doc: null, generation: 2 });
  });

  it('an unreadable store gives status unreadable; startEmpty resets it', async () => {
    const ctx = setup({ loadError: new ShowStoreError('unreadable') });
    await expect(ctx.session.startEmpty()).rejects.toThrow();

    const opened = await ctx.session.open();
    expect(opened).toEqual({ unreadable: true, generation: 1 });
    expect(ctx.session.state().status).toBe('unreadable');

    const empty = await ctx.session.startEmpty();
    expect(ctx.showStore.resetUnreadable).toHaveBeenCalledWith('Alice');
    expect(empty).toEqual({ layout: normalizeLayout(null), generation: 1, recovery: null });
    expect(ctx.session.state().status).toBe('loading');
    await expect(ctx.session.startEmpty()).rejects.toThrow();

    // Other store errors fail the open and do not allow startEmpty
    for (const code of ['io', 'version', 'unregistered', 'shape']) {
      const failing = setup({ loadError: new ShowStoreError(code) });
      const result = await failing.session.open();
      expect(result).toEqual({ failed: true, error: code, generation: 1 });
      expect(failing.session.state().status).toBe('failed');
      await expect(failing.session.startEmpty()).rejects.toThrow();
    }
  });

  it('startEmpty reports the recovery record as open() would, with the same handoff rules', async () => {
    const record = { version: 1, showId: 'show-1', savedAt: T0 - MINUTE, layout: layoutWith(9) };
    const cases = [
      [{ handoff: null }, null],
      [{ handoff: 'renderer-crash', handoffAt: T0 - MINUTE }, 'renderer-crash'],
      [{ handoff: 'update', handoffAt: T0 - 16 * MINUTE }, null],
    ];
    for (const [extra, handoff] of cases) {
      const ctx = setup({ loadError: new ShowStoreError('unreadable') });
      ctx.recoveryStore.records.set('Alice', { ...record, ...extra });
      await ctx.session.open();
      const empty = await ctx.session.startEmpty();
      expect(empty.recovery).toEqual({ savedAt: T0 - MINUTE, handoff, showId: 'show-1' });
      // Restoring lands the show in progress on the empty show
      await expect(ctx.session.resolveRecovery('restore')).resolves.toEqual({ layout: layoutWith(9), counts: {} });
    }

    // Discarding retires the record and keeps the empty show
    const discard = setup({ loadError: new ShowStoreError('unreadable') });
    discard.recoveryStore.records.set('Alice', { ...record, handoff: null });
    await discard.session.open();
    await discard.session.startEmpty();
    await expect(discard.session.resolveRecovery('discard')).resolves.toEqual({ layout: normalizeLayout(null), counts: {} });
    expect(discard.recoveryStore.records.has('Alice')).toBe(false);
  });

  it('a clean exit or switch before the show was ever ready keeps the record', async () => {
    const record = { version: 1, showId: 'show-1', savedAt: T0, handoff: null, layout: layoutWith(9) };
    const states = {
      // e.g. quit while the crash prompt is still open
      loading: async (ctx) => { await ctx.session.open(); },
      failed: async (ctx) => {
        const opened = await ctx.session.open();
        ctx.session.reportReady(opened.generation, false);
      },
      unreadable: async (ctx) => { await ctx.session.open(); },
    };
    for (const [state, reach] of Object.entries(states)) {
      for (const reason of ['clean-exit', 'switch']) {
        const ctx = setup(state === 'unreadable' ? { loadError: new ShowStoreError('unreadable') } : {});
        ctx.recoveryStore.records.set('Alice', record);
        await reach(ctx);
        expect(ctx.session.state().status, state).toBe(state);
        await ctx.session.end(reason);
        expect(ctx.recoveryStore.retire, `${state} ${reason}`).not.toHaveBeenCalled();
        expect(ctx.recoveryStore.records.get('Alice'), `${state} ${reason}`).toEqual(record);
      }
    }

    // Other exits still retire it, and a library import still clears all
    const deleted = setup();
    deleted.recoveryStore.records.set('Alice', record);
    await deleted.session.open();
    await deleted.session.end('profile-deleted');
    expect(deleted.recoveryStore.records.has('Alice')).toBe(false);
    const imported = setup();
    imported.recoveryStore.records.set('Alice', record);
    await imported.session.open();
    await imported.session.end('library-import');
    expect(imported.recoveryStore.clearAll).toHaveBeenCalled();
  });

  it('restoring a handed-off record makes it an ordinary record, so a second crash asks', async () => {
    for (const savedAt of [T0, T0 - 16 * MINUTE]) {
      const ctx = setup();
      ctx.recoveryStore.records.set('Alice', { version: 1, showId: 'show-1', savedAt, handoff: 'update', layout: layoutWith(9) });
      await ctx.session.open();
      await expect(ctx.session.resolveRecovery('restore')).resolves.toEqual({ layout: layoutWith(9), counts: {} });
      expect(ctx.recoveryStore.records.get('Alice')).toEqual({
        version: 1, showId: 'show-1', savedAt, handoff: null, layout: layoutWith(9)
      });

      // The next open (after another crash) reports it without a handoff
      const reopened = await ctx.session.open();
      expect(reopened.recovery).toEqual({ savedAt, handoff: null, showId: 'show-1' });
    }

    // An ordinary record is not rewritten on restore
    const plain = setup();
    plain.recoveryStore.records.set('Alice', { version: 1, showId: 'show-1', savedAt: T0, handoff: null, layout: layoutWith(9) });
    await plain.session.open();
    await plain.session.resolveRecovery('restore');
    expect(plain.recoveryStore.clearHandoff).not.toHaveBeenCalled();
  });

  it('a failed report after a failed open is accepted without a stale warning', async () => {
    const ctx = setup({ loadError: new ShowStoreError('version') });
    const opened = await ctx.session.open();
    expect(opened).toMatchObject({ failed: true });
    ctx.session.reportReady(opened.generation, false);
    expect(ctx.session.state().status).toBe('failed');
    expect(ctx.debugLog.info).not.toHaveBeenCalledWith('Ignoring stale show ready report', expect.anything());
  });

  it('restore onto a deleted showId lands on the active show', async () => {
    const ctx = setup();
    ctx.recoveryStore.records.set('Alice', {
      version: 1, showId: 'deleted-show', savedAt: T0, handoff: null,
      layout: { hotkeys: [{ tabNumber: 1, hotkeys: { f2: '7' } }] },
    });
    const opened = await ctx.session.open();
    expect(opened.recovery.showId).toBe('deleted-show');

    const restored = await ctx.session.resolveRecovery('restore');
    expect(restored).toEqual({ layout: normalizeLayout({ hotkeys: [{ tabNumber: 1, hotkeys: { f2: '7' } }] }), counts: {} });
    expect(ctx.recoveryStore.records.has('Alice')).toBe(true);

    // Later writes from the restored session go to the active show
    ctx.session.reportReady(opened.generation, true);
    await ctx.session.saveRecovery(restored.layout);
    expect(ctx.recoveryStore.records.get('Alice').showId).toBe(ctx.doc.activeShowId);
  });

  it('discard retires the record and returns the saved layout', async () => {
    const ctx = setup();
    ctx.recoveryStore.records.set('Alice', { version: 1, showId: 'x', savedAt: T0, handoff: null, layout: layoutWith(7) });
    await ctx.session.open();

    await expect(ctx.session.resolveRecovery('bogus')).rejects.toThrow('Invalid recovery choice');
    await expect(ctx.session.resolveRecovery('discard')).resolves.toEqual({ layout: layoutWith(1), counts: {} });
    expect(ctx.recoveryStore.discard).toHaveBeenCalledWith('Alice');

    // Nothing reported: just the saved layout, nothing retired
    ctx.recoveryStore.discard.mockClear();
    await expect(ctx.session.resolveRecovery('restore')).resolves.toEqual({ layout: layoutWith(1), counts: {} });
    expect(ctx.recoveryStore.discard).not.toHaveBeenCalled();
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalled();
  });

  it('end awaits the pending renderer-crash handoff', async () => {
    const ctx = setup();
    await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));
    let release;
    ctx.recoveryStore.markHandoff.mockImplementationOnce(async (profile, reason) => {
      await new Promise((resolve) => { release = resolve; });
      ctx.recoveryStore.calls.push(['markHandoff', profile, reason]);
    });

    ctx.session.rendererGone();
    const ending = ctx.session.end('backup-restore');
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalled();
    release();
    await ending;
    expect(ctx.recoveryStore.calls.slice(-2)).toEqual([
      ['markHandoff', 'Alice', 'renderer-crash'],
      ['retire', 'Alice'],
    ]);
  });

  it('a failing menu rebuild or handoff never breaks the session', async () => {
    const ctx = setup();
    ctx.rebuildMenu.mockImplementation(() => { throw new Error('menu'); });
    const opened = await ctx.session.open();
    ctx.session.reportReady(opened.generation, true);
    expect(ctx.session.state().status).toBe('ready');

    ctx.recoveryStore.markHandoff.mockRejectedValueOnce(new Error('disk'));
    expect(() => ctx.session.rendererGone()).not.toThrow();
    await expect(ctx.session.end('clean-exit')).resolves.toBeUndefined();
  });
});

/** Two shows; show-1 is active. */
function twoShowDoc() {
  let n = 0;
  const newId = () => `show-${++n}`;
  const first = createDocument(layoutWith(1), { now: T0, newId });
  return addShow(first, { name: 'Second', layout: layoutWith(2), now: T0, newId, activate: false }).doc;
}

/** Make the next recovery write hang until released. */
function holdNextWrite(ctx) {
  const held = {};
  ctx.recoveryStore.write.mockImplementationOnce(async (profile, { showId, layout }) => {
    await new Promise((resolve) => { held.release = resolve; });
    ctx.recoveryStore.calls.push(['write', profile]);
    ctx.recoveryStore.records.set(profile, { version: 1, showId, savedAt: T0, handoff: null, layout });
  });
  return held;
}

describe('show session mutations', () => {
  it('updateActive is refused unless ready', async () => {
    const ctx = setup();
    await expect(ctx.session.updateActive(layoutWith(5))).rejects.toThrow('session not ready');
    const opened = await ctx.session.open();
    await expect(ctx.session.updateActive(layoutWith(5))).rejects.toThrow('session not ready');
    ctx.session.reportReady(opened.generation, true);

    // A fenced session (handed off) is refused too
    await ctx.session.handoff('update');
    for (const call of [
      () => ctx.session.updateActive(layoutWith(5)),
      () => ctx.session.activate('show-1'),
      () => ctx.session.revert(),
      () => ctx.session.createShow('New', layoutWith(5)),
      () => ctx.session.renameShow('show-1', 'Renamed'),
      () => ctx.session.deleteShow('show-1'),
      () => ctx.session.importShow('Bob', 'show-1'),
      () => ctx.session.setShowColor('show-1', 'teal'),
    ]) {
      await expect(call()).rejects.toThrow('session not ready');
    }
    expect(ctx.showStore.save).not.toHaveBeenCalled();

    // A ready session saves the show, then retires recovery; still ready, same generation
    const ready = setup();
    const readyOpened = await openReady(ready);
    await ready.session.saveRecovery(layoutWith(5));
    ready.rebuildMenu.mockClear();
    await ready.session.updateActive({ ...layoutWith(5), extra: true });
    const saved = ready.showStore.save.mock.calls[0][1];
    expect(ready.showStore.save).toHaveBeenCalledWith('Alice', expect.anything());
    expect(saved.shows[0].layout).toEqual(layoutWith(5));
    expect(ready.session.state()).toMatchObject({ status: 'ready', generation: readyOpened.generation, doc: saved });
    expect(ready.recoveryStore.records.has('Alice')).toBe(false);
    expect(ready.rebuildMenu).toHaveBeenCalled();
    // Not fenced afterwards
    await expect(ready.session.saveRecovery(layoutWith(6))).resolves.toEqual({ dirty: true });
  });

  it('a second mutation while one runs is rejected as busy', async () => {
    const ctx = setup({ doc: twoShowDoc() });
    await openReady(ctx);
    let release;
    ctx.showStore.save.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));

    const first = ctx.session.renameShow('show-2', 'Renamed');
    await expect(ctx.session.updateActive(layoutWith(5))).rejects.toThrow('busy');
    await expect(ctx.session.activate('show-2')).rejects.toThrow('busy');
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    release();
    await first;

    expect(ctx.showStore.save).toHaveBeenCalledTimes(1);
    expect(ctx.session.state().doc.shows[1].name).toBe('Renamed');
    // Free again once the first settles
    await expect(ctx.session.renameShow('show-2', 'Again')).resolves.toBeDefined();
  });

  // Electron moves a radio check on click, so the menu must be rebuilt from
  // the session even when the switch never happened
  it('a rejected or failed mutation still rebuilds the menu', async () => {
    const notReady = setup({ doc: twoShowDoc() });
    await notReady.session.open();
    notReady.rebuildMenu.mockClear();
    await expect(notReady.session.activate('show-2')).rejects.toThrow('session not ready');
    expect(notReady.rebuildMenu).toHaveBeenCalledTimes(1);

    const ctx = setup({ doc: twoShowDoc() });
    await openReady(ctx);
    let release;
    ctx.showStore.save.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const first = ctx.session.renameShow('show-2', 'Renamed');
    ctx.rebuildMenu.mockClear();
    await expect(ctx.session.activate('show-2')).rejects.toThrow('busy');
    expect(ctx.rebuildMenu).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    release();
    await first;

    ctx.rebuildMenu.mockClear();
    await expect(ctx.session.activate('missing')).rejects.toThrow('Show not found.');
    expect(ctx.rebuildMenu).toHaveBeenCalledTimes(1);

    ctx.rebuildMenu.mockClear();
    ctx.showStore.save.mockRejectedValueOnce(new Error('disk full'));
    await expect(ctx.session.activate('show-2')).rejects.toThrow('disk full');
    expect(ctx.rebuildMenu).toHaveBeenCalled();
    expect(ctx.session.state()).toMatchObject({ status: 'ready' });
  });

  it('activate of the active show is rejected and changes nothing', async () => {
    const ctx = setup({ doc: twoShowDoc() });
    const opened = await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));

    await expect(ctx.session.activate('show-1')).rejects.toThrow('already active');
    await expect(ctx.session.activate('missing')).rejects.toThrow('Show not found.');

    expect(ctx.showStore.save).not.toHaveBeenCalled();
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalled();
    expect(ctx.session.state()).toMatchObject({ status: 'ready', generation: opened.generation });
    await expect(ctx.session.saveRecovery(layoutWith(10))).resolves.toEqual({ dirty: true });
  });

  it('activate fences and retires recovery before returning the new layout', async () => {
    const ctx = setup({ doc: twoShowDoc() });
    const opened = await openReady(ctx);

    // A recovery write of the old layout is already in flight
    const held = holdNextWrite(ctx);
    const inFlight = ctx.session.saveRecovery(layoutWith(8));
    await vi.waitFor(() => expect(held.release).toBeTypeOf('function'));

    const activating = ctx.session.activate('show-2');
    // Fenced synchronously: a later write of the old layout is skipped
    const late = ctx.session.saveRecovery(layoutWith(9));
    await Promise.resolve();
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalled();
    held.release();
    const result = await activating;
    await inFlight;

    await expect(late).resolves.toMatchObject({ skipped: true });
    expect(result).toEqual({ layout: layoutWith(2), generation: opened.generation + 1 });
    expect(ctx.recoveryStore.calls).toEqual([['write', 'Alice'], ['retire', 'Alice']]);
    expect(ctx.recoveryStore.records.has('Alice')).toBe(false);
    expect(ctx.showStore.save.mock.calls[0][1].activeShowId).toBe('show-2');
    expect(ctx.session.state()).toMatchObject({ status: 'loading', generation: result.generation });
    expect(ctx.session.state().doc.activeShowId).toBe('show-2');

    // Writes stay refused while loading; the new generation's ready report unfences
    await expect(ctx.session.saveRecovery(layoutWith(9))).resolves.toMatchObject({ skipped: true });
    ctx.session.reportReady(opened.generation, true);
    expect(ctx.session.state().status).toBe('loading');
    ctx.session.reportReady(result.generation, true);
    expect(ctx.session.state().status).toBe('ready');
    await expect(ctx.session.saveRecovery(layoutWith(9))).resolves.toEqual({ dirty: true });
    expect(ctx.recoveryStore.records.get('Alice')).toMatchObject({ showId: 'show-2', layout: layoutWith(9) });
  });

  it('revert retires recovery and reloads the saved active show', async () => {
    const ctx = setup({ doc: twoShowDoc() });
    const opened = await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));

    const result = await ctx.session.revert();

    expect(result).toEqual({ layout: layoutWith(1), generation: opened.generation + 1 });
    expect(ctx.showStore.save).not.toHaveBeenCalled();
    expect(ctx.recoveryStore.records.has('Alice')).toBe(false);
    expect(ctx.session.state().status).toBe('loading');
    ctx.session.reportReady(result.generation, true);
    await expect(ctx.session.saveRecovery(layoutWith(7))).resolves.toEqual({ dirty: true });
  });

  it('a failed save leaves the doc, recovery and status unchanged', async () => {
    const ctx = setup({ doc: twoShowDoc() });
    const opened = await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));
    const record = ctx.recoveryStore.records.get('Alice');
    const docBefore = ctx.session.state().doc;
    ctx.showStore.save.mockRejectedValue(new ShowStoreError('io', 'disk full'));

    for (const call of [
      () => ctx.session.activate('show-2'),
      () => ctx.session.updateActive(layoutWith(5)),
      () => ctx.session.createShow('New', layoutWith(5)),
      () => ctx.session.renameShow('show-2', 'Renamed'),
      () => ctx.session.deleteShow('show-1'),
      () => ctx.session.deleteShow('show-2'),
    ]) {
      await expect(call()).rejects.toThrow('disk full');
      expect(ctx.session.state()).toMatchObject({ status: 'ready', generation: opened.generation, doc: docBefore });
      expect(ctx.recoveryStore.records.get('Alice')).toBe(record);
    }
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalled();
    // The fence came back down, and the lock was released
    await expect(ctx.session.saveRecovery(layoutWith(10))).resolves.toEqual({ dirty: true });
    ctx.showStore.save.mockResolvedValue(undefined);
    await expect(ctx.session.renameShow('show-2', 'Renamed')).resolves.toBeDefined();
  });

  it('createShow makes the new show active and stays ready', async () => {
    const ctx = setup();
    const opened = await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));

    await expect(ctx.session.createShow('  ', layoutWith(9))).rejects.toThrow('Enter a name for the show.');
    await expect(ctx.session.createShow('default show', layoutWith(9))).rejects.toThrow('A show with this name already exists.');
    const created = await ctx.session.createShow('Show Two', layoutWith(9));

    expect(created).toEqual({ id: 'new-id', name: 'Show Two' });
    const { doc } = ctx.session.state();
    expect(doc.activeShowId).toBe('new-id');
    expect(doc.shows.at(-1)).toMatchObject({ name: 'Show Two', layout: layoutWith(9), createdAt: T0 });
    expect(ctx.session.state()).toMatchObject({ status: 'ready', generation: opened.generation });
    expect(ctx.recoveryStore.records.has('Alice')).toBe(false);
    await expect(ctx.session.saveRecovery(layoutWith(3))).resolves.toEqual({ dirty: true });
    expect(ctx.recoveryStore.records.get('Alice').showId).toBe('new-id');
  });

  it('setShowColor is refused unless ready, saves at once, and leaves dirty, recovery and the layout alone', async () => {
    const ctx = setup({ doc: twoShowDoc() });
    await expect(ctx.session.setShowColor('show-1', 'teal')).rejects.toThrow('session not ready');
    const opened = await ctx.session.open();
    await expect(ctx.session.setShowColor('show-1', 'teal')).rejects.toThrow('session not ready');
    ctx.session.reportReady(opened.generation, true);
    expect(ctx.showStore.save).not.toHaveBeenCalled();

    await ctx.session.saveRecovery(layoutWith(9));
    const record = ctx.recoveryStore.records.get('Alice');
    const layoutBefore = ctx.session.state().doc.shows[0].layout;
    ctx.recoveryStore.calls.length = 0;
    ctx.rebuildMenu.mockClear();

    await expect(ctx.session.setShowColor('show-1', 'mauve')).rejects.toThrow('Invalid show color');
    await expect(ctx.session.setShowColor('nope', 'teal')).rejects.toThrow('Show not found.');
    expect(ctx.showStore.save).not.toHaveBeenCalled();

    const result = await ctx.session.setShowColor('show-1', 'teal');
    expect(result).toEqual({ id: 'show-1', color: 'teal' });
    const saved = ctx.showStore.save.mock.calls[0][1];
    expect(saved.shows[0].color).toBe('teal');
    expect(saved.shows[0].layout).toEqual(layoutBefore);
    expect(ctx.session.state()).toMatchObject({ status: 'ready', generation: opened.generation, dirty: true, doc: saved });
    expect(ctx.recoveryStore.records.get('Alice')).toBe(record);
    expect(ctx.recoveryStore.calls).toEqual([]);
    expect(ctx.rebuildMenu).toHaveBeenCalled();

    // A clean session stays clean; a non-active show can be colored too
    await ctx.session.updateActive(layoutWith(9));
    expect(ctx.session.state().dirty).toBe(false);
    await ctx.session.setShowColor('show-2', null);
    expect(ctx.session.state().dirty).toBe(false);
    expect(ctx.session.state().doc.shows[1].color).toBeNull();
  });

  it('createShow (Save As) copies the active show\'s color', async () => {
    const ctx = setup();
    await openReady(ctx);
    await ctx.session.setShowColor(ctx.doc.activeShowId, 'coral');
    await ctx.session.createShow('Show Two', layoutWith(9));
    expect(ctx.session.state().doc.shows.at(-1)).toMatchObject({ name: 'Show Two', color: 'coral' });
  });

  it('renameShow keeps status and rejects invalid names with the exact message', async () => {
    const ctx = setup({ doc: twoShowDoc() });
    await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));

    await expect(ctx.session.renameShow('show-1', 'second')).rejects.toThrow('A show with this name already exists.');
    await expect(ctx.session.renameShow('show-1', 'x'.repeat(51))).rejects.toThrow('Show names can be at most 50 characters.');
    await expect(ctx.session.renameShow('nope', 'Fine')).rejects.toThrow('Show not found.');
    expect(ctx.showStore.save).not.toHaveBeenCalled();
    ctx.rebuildMenu.mockClear();

    await ctx.session.renameShow('show-1', ' Opening ');
    expect(ctx.session.state().doc.shows[0].name).toBe('Opening');
    expect(ctx.session.state().status).toBe('ready');
    expect(ctx.recoveryStore.records.has('Alice')).toBe(true);
    expect(ctx.rebuildMenu).toHaveBeenCalled();
  });

  it('deleting a non-active show leaves status ready and recovery intact', async () => {
    const ctx = setup({ doc: twoShowDoc() });
    const opened = await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));

    await expect(ctx.session.deleteShow('show-2')).resolves.toEqual({ activeChanged: false });
    expect(ctx.session.state().doc.shows.map((b) => b.id)).toEqual(['show-1']);
    expect(ctx.session.state()).toMatchObject({ status: 'ready', generation: opened.generation });
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalled();
    expect(ctx.recoveryStore.records.has('Alice')).toBe(true);
    await expect(ctx.session.saveRecovery(layoutWith(10))).resolves.toEqual({ dirty: true });
  });

  it('deleting the active show fences, retires and loads the next show', async () => {
    const ctx = setup({ doc: twoShowDoc() });
    const opened = await openReady(ctx);
    const held = holdNextWrite(ctx);
    const inFlight = ctx.session.saveRecovery(layoutWith(8));
    await vi.waitFor(() => expect(held.release).toBeTypeOf('function'));

    const deleting = ctx.session.deleteShow('show-1');
    const late = ctx.session.saveRecovery(layoutWith(9));
    held.release();
    const result = await deleting;
    await inFlight;

    await expect(late).resolves.toMatchObject({ skipped: true });
    expect(result).toEqual({ activeChanged: true, layout: layoutWith(2), generation: opened.generation + 1 });
    expect(ctx.recoveryStore.calls).toEqual([['write', 'Alice'], ['retire', 'Alice']]);
    expect(ctx.session.state()).toMatchObject({ status: 'loading', generation: result.generation });
    expect(ctx.session.state().doc.activeShowId).toBe('show-2');
  });

  it('a renderer-crash handoff during a mutation cannot write the old record back after the retire', async () => {
    for (const run of [
      (ctx) => ctx.session.activate('show-2'),
      (ctx) => ctx.session.updateActive(layoutWith(5)),
    ]) {
      const ctx = setup({ doc: twoShowDoc() });
      await openReady(ctx);
      await ctx.session.saveRecovery(layoutWith(8));
      // markHandoff loads, then writes: give the retire a chance to slip between
      ctx.recoveryStore.markHandoff.mockImplementationOnce(async (profile, reason) => {
        const record = ctx.recoveryStore.records.get(profile);
        await new Promise((resolve) => setTimeout(resolve, 5));
        ctx.recoveryStore.calls.push(['markHandoff', profile, reason]);
        if (!record) return false;
        ctx.recoveryStore.records.set(profile, { ...record, handoff: reason });
        return true;
      });
      let release;
      ctx.showStore.save.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));

      const mutating = run(ctx);
      await vi.waitFor(() => expect(release).toBeTypeOf('function'));
      ctx.session.rendererGone();
      release();
      await mutating;
      await vi.waitFor(() => expect(ctx.recoveryStore.markHandoff).toHaveBeenCalled());
      await ctx.session.end('clean-exit');

      // Mark and retire ran in queue order, so the old layout is gone
      expect(ctx.recoveryStore.records.has('Alice')).toBe(false);
    }
  });

  it('a handoff during a mutation keeps the fence up afterwards', async () => {
    const ctx = setup({ doc: twoShowDoc() });
    await openReady(ctx);
    let release;
    ctx.showStore.save.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const activating = ctx.session.activate('show-2');
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    await ctx.session.handoff('update');
    release();
    const result = await activating;

    ctx.session.reportReady(result.generation, true);
    expect(ctx.session.state().status).toBe('ready');
    await expect(ctx.session.saveRecovery(layoutWith(9))).resolves.toMatchObject({ skipped: true });
    await expect(ctx.session.updateActive(layoutWith(9))).rejects.toThrow('session not ready');

    // A failed save during a handoff leaves the fence up too
    const failing = setup({ doc: twoShowDoc() });
    await openReady(failing);
    let fail;
    failing.showStore.save.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
    const updating = failing.session.updateActive(layoutWith(5));
    await vi.waitFor(() => expect(fail).toBeTypeOf('function'));
    await failing.session.handoff('update');
    fail(new Error('disk full'));
    await expect(updating).rejects.toThrow('disk full');
    await expect(failing.session.saveRecovery(layoutWith(9))).resolves.toMatchObject({ skipped: true });
  });

  it('a mutation superseded by end() does not touch the ended session', async () => {
    const ctx = setup({ doc: twoShowDoc() });
    await openReady(ctx);
    let release;
    ctx.showStore.save.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const activating = ctx.session.activate('show-2');
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    await ctx.session.end('clean-exit');
    release();
    await expect(activating).rejects.toThrow('superseded');
    expect(ctx.session.state().status).toBe('idle');
  });
});

describe('show session dirty flag', () => {
  const dirty = (ctx) => ctx.session.state().dirty;

  it('a recovery write sets dirty, a retire as equal clears it, and a skipped save leaves it', async () => {
    const ctx = setup();
    const opened = await ctx.session.open();
    expect(dirty(ctx)).toBe(false);
    // Skipped while loading: unchanged
    await expect(ctx.session.saveRecovery(layoutWith(9))).resolves.toEqual({ skipped: true, dirty: false });
    ctx.session.reportReady(opened.generation, true);

    await expect(ctx.session.saveRecovery(layoutWith(9))).resolves.toEqual({ dirty: true });
    expect(dirty(ctx)).toBe(true);
    // Fenced: skipped, still dirty
    await ctx.session.handoff('update');
    await expect(ctx.session.saveRecovery(layoutWith(1))).resolves.toEqual({ skipped: true, dirty: true });
    expect(dirty(ctx)).toBe(true);

    // Undone back to the saved show
    await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));
    await expect(ctx.session.saveRecovery(layoutWith(1))).resolves.toEqual({ retired: true, dirty: false });
    expect(dirty(ctx)).toBe(false);
  });

  it('a failed recovery write still marks the layout on screen dirty', async () => {
    const ctx = setup();
    await openReady(ctx);
    ctx.recoveryStore.write.mockRejectedValueOnce(new Error('disk full'));
    await expect(ctx.session.saveRecovery(layoutWith(9))).rejects.toThrow('disk full');
    // The screen differs from the saved show whether or not the copy was written
    expect(dirty(ctx)).toBe(true);
  });

  it('a failed retire as equal still clears dirty', async () => {
    const ctx = setup();
    await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));
    expect(dirty(ctx)).toBe(true);
    ctx.recoveryStore.retire.mockRejectedValueOnce(new Error('disk full'));
    await expect(ctx.session.saveRecovery(layoutWith(1))).rejects.toThrow('disk full');
    expect(dirty(ctx)).toBe(false);
  });

  it('open clears dirty; restoring a recovery record sets it once ready, discarding clears it', async () => {
    const ctx = setup();
    await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));
    expect(dirty(ctx)).toBe(true);

    let opened = await ctx.session.open();
    expect(dirty(ctx)).toBe(false);
    await ctx.session.resolveRecovery('restore');
    // Not ready yet: nothing on screen is the show
    expect(dirty(ctx)).toBe(false);
    ctx.session.reportReady(opened.generation, true);
    expect(dirty(ctx)).toBe(true);

    opened = await ctx.session.open();
    await ctx.session.resolveRecovery('discard');
    ctx.session.reportReady(opened.generation, true);
    expect(dirty(ctx)).toBe(false);

    // Restore with no record keeps the saved layout, so nothing is unsaved
    ctx.recoveryStore.records.clear();
    opened = await ctx.session.open();
    await ctx.session.resolveRecovery('restore');
    ctx.session.reportReady(opened.generation, true);
    expect(dirty(ctx)).toBe(false);
  });

  it('a restore whose layout fails to apply never reads dirty', async () => {
    const ctx = setup();
    ctx.recoveryStore.records.set('Alice', { version: 1, showId: 'x', savedAt: T0, handoff: null, layout: layoutWith(7) });
    const opened = await ctx.session.open();
    await ctx.session.resolveRecovery('restore');
    ctx.session.reportReady(opened.generation, false);
    expect(ctx.session.state()).toMatchObject({ status: 'failed', dirty: false });
    await expect(ctx.session.saveRecovery(layoutWith(9))).resolves.toEqual({ skipped: true, dirty: false });
  });

  /** Make the next show save hang until released. */
  function holdNextSave(ctx) {
    const held = {};
    ctx.showStore.save.mockImplementationOnce(() => new Promise((resolve) => { held.release = resolve; }));
    return held;
  }

  for (const [name, save] of [
    ['updateActive', (session) => session.updateActive(layoutWith(9))],
    ['createShow', (session) => session.createShow('Late Show', layoutWith(9))],
  ]) {
    it(`${name} keeps the record and dirty when a different layout was written while it saved`, async () => {
      const ctx = setup();
      await openReady(ctx);
      await ctx.session.saveRecovery(layoutWith(9));
      const held = holdNextSave(ctx);
      const saving = save(ctx.session);
      await vi.waitFor(() => expect(held.release).toBeTypeOf('function'));

      // An edit after the layout was taken lands while the show is saved
      await expect(ctx.session.saveRecovery(layoutWith(10))).resolves.toEqual({ dirty: true });
      held.release();
      await saving;

      expect(ctx.recoveryStore.records.get('Alice')?.layout).toEqual(layoutWith(10));
      expect(dirty(ctx)).toBe(true);
    });

    it(`${name} still retires when the write that landed while it saved is the saved layout`, async () => {
      const ctx = setup();
      await openReady(ctx);
      const held = holdNextSave(ctx);
      const saving = save(ctx.session);
      await vi.waitFor(() => expect(held.release).toBeTypeOf('function'));

      // The debounced save of the same layout, compared against the old show
      await ctx.session.saveRecovery(layoutWith(9));
      held.release();
      await saving;

      expect(ctx.recoveryStore.records.has('Alice')).toBe(false);
      expect(dirty(ctx)).toBe(false);
    });

    it(`${name} stays dirty and keeps a record when the edit was undone to the old show while it saved`, async () => {
      const ctx = setup();
      await openReady(ctx);
      await ctx.session.saveRecovery(layoutWith(9));
      const held = holdNextSave(ctx);
      const saving = save(ctx.session);
      await vi.waitFor(() => expect(held.release).toBeTypeOf('function'));

      // Undone to the old saved layout: retired as equal against the old show
      await expect(ctx.session.saveRecovery(layoutWith(1))).resolves.toEqual({ retired: true, dirty: false });
      held.release();
      await saving;

      // The screen now differs from the show just saved
      expect(dirty(ctx)).toBe(true);
      expect(ctx.recoveryStore.records.get('Alice')?.layout).toEqual(layoutWith(1));
    });
  }

  // activate and revert retire through the write queue, so they always run
  // after an in-flight write; open() starts a new generation at once
  it('a write that finishes after a newer open does not mark the new session dirty', async () => {
    const ctx = setup();
    await openReady(ctx);
    const held = holdNextWrite(ctx);
    const inFlight = ctx.session.saveRecovery(layoutWith(8));
    await vi.waitFor(() => expect(held.release).toBeTypeOf('function'));

    const opened = await ctx.session.open();
    held.release();
    await inFlight;
    ctx.session.reportReady(opened.generation, true);
    expect(dirty(ctx)).toBe(false);
  });

  it('a write held while activate or revert runs leaves the new generation clean', async () => {
    for (const run of [(session) => session.activate('show-2'), (session) => session.revert()]) {
      const ctx = setup({ doc: twoShowDoc() });
      await openReady(ctx);
      const held = holdNextWrite(ctx);
      const inFlight = ctx.session.saveRecovery(layoutWith(8));
      await vi.waitFor(() => expect(held.release).toBeTypeOf('function'));

      const reloading = run(ctx.session);
      held.release();
      const result = await reloading;
      await inFlight;
      ctx.session.reportReady(result.generation, true);
      expect(dirty(ctx)).toBe(false);
    }
  });

  it('save, save as, activate, revert, deleting the active show and import clear dirty', async () => {
    const ctx = setup({ doc: twoShowDoc(), profiles: ['Alice', 'Bob'] });
    ctx.showStore.peek.mockResolvedValue(twoShowDoc());
    await openReady(ctx);
    const steps = [
      ['updateActive', () => ctx.session.updateActive(layoutWith(9))],
      ['createShow', () => ctx.session.createShow('Third', layoutWith(9))],
      ['activate', () => ctx.session.activate('show-2')],
      ['revert', () => ctx.session.revert()],
      ['importShow', () => ctx.session.importShow('Bob', 'show-1')],
      ['deleteShow', () => ctx.session.deleteShow(ctx.session.state().doc.activeShowId)],
    ];
    for (const [name, step] of steps) {
      if (ctx.session.state().status !== 'ready') ctx.session.reportReady(ctx.session.state().generation, true);
      await ctx.session.saveRecovery(layoutWith(42));
      expect(dirty(ctx), `${name}: before`).toBe(true);
      await step();
      expect(dirty(ctx), `${name}: after`).toBe(false);
    }
  });

  it('rename and a failed save leave dirty as it was', async () => {
    const ctx = setup({ doc: twoShowDoc() });
    await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));
    await ctx.session.renameShow('show-1', 'Opening');
    expect(dirty(ctx)).toBe(true);
    ctx.showStore.save.mockRejectedValueOnce(new ShowStoreError('io', 'disk full'));
    await expect(ctx.session.updateActive(layoutWith(9))).rejects.toThrow('disk full');
    expect(dirty(ctx)).toBe(true);
  });

  it('startEmpty clears dirty', async () => {
    const ctx = setup({ loadError: new ShowStoreError('unreadable', 'bad json') });
    await ctx.session.open();
    expect(ctx.session.state().status).toBe('unreadable');
    await ctx.session.startEmpty();
    expect(dirty(ctx)).toBe(false);
  });
});

describe('show session imports', () => {
  const dirs = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) nodeFs.rmSync(dir, { recursive: true, force: true });
  });

  /** A real show store over a temp profiles directory, with every fs write recorded. */
  function realStoreSetup(registered) {
    const root = nodeFs.mkdtempSync(path.join(os.tmpdir(), 'show-import-'));
    dirs.push(root);
    const writes = [];
    const MUTATORS = new Set(['writeFile', 'rename', 'copyFile', 'rm', 'mkdir', 'unlink', 'appendFile']);
    const promises = new Proxy(nodeFs.promises, {
      get(target, key) {
        const value = target[key];
        if (typeof value !== 'function') return value;
        return (...args) => {
          if (MUTATORS.has(key) || (key === 'open' && args[1] !== 'r')) writes.push([key, String(args[0])]);
          return value.apply(target, args);
        };
      },
    });
    const fs = { ...nodeFs, promises };
    const dir = (name) => path.join(root, name);
    const showStore = createShowStore({
      fs,
      getProfileShowsPath: (name) => path.join(dir(name), 'shows.json'),
      getProfileStatePath: (name) => path.join(dir(name), 'state.json'),
      profileExists: (name) => registered.includes(name),
    });
    const writeFile = (name, file, value) => {
      nodeFs.mkdirSync(dir(name), { recursive: true });
      nodeFs.writeFileSync(path.join(dir(name), file), typeof value === 'string' ? value : JSON.stringify(value));
    };
    const snapshot = (name) => {
      if (!nodeFs.existsSync(dir(name))) return {};
      return Object.fromEntries(nodeFs.readdirSync(dir(name)).map((f) => [f, nodeFs.readFileSync(path.join(dir(name), f))]));
    };
    return { showStore, writes, writeFile, snapshot, dir };
  }

  it('listImportable excludes the current profile, includes never-opened profiles, and writes nothing', async () => {
    const registered = ['Alice', 'zed', 'Default User', 'Bob', 'Carol'];
    const store = realStoreSetup(registered);
    const bobDoc = twoShowDoc();
    store.writeFile('Bob', 'shows.json', bobDoc);
    store.writeFile('zed', 'shows.json', makeDoc());
    // Never opened since the upgrade: only a state.json
    store.writeFile('Default User', 'state.json', layoutWith(4));
    // Unreadable: skipped
    store.writeFile('Carol', 'shows.json', '{ not json');
    store.writeFile('Carol', 'shows.json.prev', '{ not json');

    const ctx = setup({ showStore: store.showStore, profiles: registered });
    await expect(ctx.session.listImportable()).rejects.toThrow('No profile is open');
    await openReady(ctx);
    store.writes.length = 0;
    const before = Object.fromEntries(registered.filter((p) => p !== 'Alice').map((p) => [p, store.snapshot(p)]));

    const list = await ctx.session.listImportable();

    expect(list.map((entry) => entry.profile)).toEqual(['Default User', 'Bob', 'zed']);
    expect(list[0].shows).toEqual([{ id: expect.any(String), name: 'Default Show', updatedAt: expect.any(Number) }]);
    expect(list[1].shows).toEqual([
      { id: 'show-1', name: 'Default Show', updatedAt: T0 },
      { id: 'show-2', name: 'Second', updatedAt: T0 },
    ]);
    expect(store.writes).toEqual([]);
    for (const [name, files] of Object.entries(before)) expect(store.snapshot(name), name).toEqual(files);
    expect(nodeFs.existsSync(path.join(store.dir('Default User'), 'shows.json'))).toBe(false);

    // Allowed while loading, too: it only needs an opened profile
    await ctx.session.revert();
    await expect(ctx.session.listImportable()).resolves.toHaveLength(3);
  });

  it('importShow imports the listed Default Show of a never-opened profile without writing its files', async () => {
    const registered = ['Alice', 'Bob'];
    const store = realStoreSetup(registered);
    store.writeFile('Alice', 'shows.json', makeDoc());
    store.writeFile('Bob', 'state.json', layoutWith(4));
    const ctx = setup({ showStore: store.showStore, profiles: registered });
    await openReady(ctx);
    const bobBefore = store.snapshot('Bob');

    const list = await ctx.session.listImportable();
    const listedId = list[0].shows[0].id;
    await ctx.session.importShow('Bob', listedId);

    const aliceDoc = JSON.parse(nodeFs.readFileSync(path.join(store.dir('Alice'), 'shows.json'), 'utf8'));
    const copy = aliceDoc.shows.find((show) => show.name === 'Default Show (Bob)');
    expect(copy).toBeTruthy();
    expect(aliceDoc.activeShowId).toBe(copy.id);
    expect(copy.id).not.toBe(listedId);
    expect(copy.importedFrom).toMatchObject({ profile: 'Bob', showId: listedId, showName: 'Default Show' });

    expect(store.snapshot('Bob')).toEqual(bobBefore);
    expect(nodeFs.existsSync(path.join(store.dir('Bob'), 'shows.json'))).toBe(false);
  });

  it('importShow names the copy "<name> (<profile>)" and leaves the source files byte-identical', async () => {
    const registered = ['Alice', 'Bob'];
    const store = realStoreSetup(registered);
    store.writeFile('Alice', 'shows.json', makeDoc());
    store.writeFile('Bob', 'shows.json', twoShowDoc());
    // Bob's show name clashes with nothing; Alice already has "Default Show"
    const ctx = setup({ showStore: store.showStore, profiles: registered });
    const opened = await openReady(ctx);
    await ctx.session.saveRecovery(layoutWith(9));
    const bobBefore = store.snapshot('Bob');
    store.writes.length = 0;

    await expect(ctx.session.importShow('Alice', 'show-1')).rejects.toThrow('Cannot import from the current profile');
    await expect(ctx.session.importShow('Mallory', 'show-1')).rejects.toThrow('not registered');
    await expect(ctx.session.importShow('Bob', 'missing')).rejects.toThrow('Show not found.');
    // A rejected import leaves the session as it was
    expect(ctx.session.state()).toMatchObject({ status: 'ready', generation: opened.generation });
    await expect(ctx.session.saveRecovery(layoutWith(10))).resolves.toEqual({ dirty: true });

    const result = await ctx.session.importShow('Bob', 'show-2');

    expect(result).toEqual({ layout: layoutWith(2), generation: opened.generation + 1 });
    const { doc, status } = ctx.session.state();
    expect(status).toBe('loading');
    const copy = doc.shows.find((b) => b.id === doc.activeShowId);
    expect(copy).toMatchObject({
      id: 'new-id',
      name: 'Second (Bob)',
      layout: layoutWith(2),
      importedFrom: { profile: 'Bob', showId: 'show-2', showName: 'Second', at: T0 },
    });
    // Saved to Alice only; Bob's files untouched
    const onDisk = JSON.parse(nodeFs.readFileSync(path.join(store.dir('Alice'), 'shows.json'), 'utf8'));
    expect(onDisk.activeShowId).toBe('new-id');
    expect(store.writes.every(([, file]) => !file.startsWith(store.dir('Bob')))).toBe(true);
    expect(store.writes.length).toBeGreaterThan(0);
    expect(store.snapshot('Bob')).toEqual(bobBefore);
    expect(ctx.recoveryStore.records.has('Alice')).toBe(false);

    // A second import of the same show gets a numbered name
    ctx.session.reportReady(result.generation, true);
    await ctx.session.importShow('Bob', 'show-2');
    expect(ctx.session.state().doc.shows.at(-1).name).toBe('Second (Bob) 2');
  });

  it('importShow copies the source show\'s color', async () => {
    const registered = ['Alice', 'Bob'];
    const store = realStoreSetup(registered);
    store.writeFile('Alice', 'shows.json', makeDoc());
    const bob = twoShowDoc();
    store.writeFile('Bob', 'shows.json', { ...bob, shows: [bob.shows[0], { ...bob.shows[1], color: 'purple' }] });
    const ctx = setup({ showStore: store.showStore, profiles: registered });
    await openReady(ctx);

    await ctx.session.importShow('Bob', 'show-2');
    const { doc } = ctx.session.state();
    expect(doc.shows.find((b) => b.id === doc.activeShowId)).toMatchObject({ name: 'Second (Bob)', color: 'purple' });
    ctx.session.reportReady(ctx.session.state().generation, true);
    await ctx.session.importShow('Bob', 'show-1');
    expect(ctx.session.state().doc.shows.at(-1).color).toBeNull();
  });
});

describe('show session played counts', () => {
  const playedRecord = (counts, extra = {}) => ({ version: 1, savedAt: T0 - MINUTE, handoff: null, counts, ...extra });

  async function readyWithoutRecovery(ctx) {
    const opened = await ctx.session.open();
    await ctx.session.resolveRecovery('discard');
    ctx.session.reportReady(opened.generation, true);
    return opened;
  }

  it('recordPlay counts per song and persists every change through the store', async () => {
    const ctx = setup();
    await readyWithoutRecovery(ctx);
    expect(ctx.session.state().hasPlayed).toBe(false);
    ctx.rebuildMenu.mockClear();

    await expect(ctx.session.recordPlay('12')).resolves.toEqual({ count: 1 });
    await expect(ctx.session.recordPlay('12')).resolves.toEqual({ count: 2 });
    await ctx.session.recordPlay('7');

    expect(ctx.recoveryStore.played.get('Alice').counts).toEqual({ 12: 2, 7: 1 });
    expect(ctx.recoveryStore.writePlayed).toHaveBeenCalledTimes(3);
    expect(ctx.session.state().hasPlayed).toBe(true);
    // The menu is rebuilt when Reset Played becomes available, not on every play
    expect(ctx.rebuildMenu).toHaveBeenCalledTimes(1);
    // Played counts are not part of the show: dirty and the layout record are untouched
    expect(ctx.session.state().dirty).toBe(false);
    expect(ctx.recoveryStore.records.has('Alice')).toBe(false);
  });

  it('clearPlayed clears one song or all of them', async () => {
    const ctx = setup();
    await readyWithoutRecovery(ctx);
    await ctx.session.recordPlay('12');
    await ctx.session.recordPlay('7');

    await ctx.session.clearPlayed('12');
    expect(ctx.recoveryStore.played.get('Alice').counts).toEqual({ 7: 1 });
    ctx.rebuildMenu.mockClear();
    await ctx.session.clearPlayed(null);
    expect(ctx.recoveryStore.played.has('Alice')).toBe(false);
    expect(ctx.session.state().hasPlayed).toBe(false);
    expect(ctx.rebuildMenu).toHaveBeenCalledTimes(1);
  });

  it('plays go to the profile captured at open and are refused once the session ends', async () => {
    const ctx = setup();
    await readyWithoutRecovery(ctx);
    ctx.current.profile = 'Bob';
    await ctx.session.recordPlay('12');
    expect(ctx.recoveryStore.played.has('Alice')).toBe(true);
    expect(ctx.recoveryStore.played.has('Bob')).toBe(false);

    // A play already queued when end() starts lands before end() retires
    const pending = ctx.session.recordPlay('12');
    await ctx.session.end('clean-exit');
    await pending;
    expect(ctx.recoveryStore.played.has('Alice')).toBe(false);
    await expect(ctx.session.recordPlay('12')).resolves.toMatchObject({ skipped: true });
    expect(ctx.recoveryStore.played.has('Alice')).toBe(false);
  });

  it('open() reports recovery for a played-only file', async () => {
    const ctx = setup();
    ctx.recoveryStore.played.set('Alice', playedRecord({ 12: 2 }));

    const opened = await ctx.session.open();

    expect(opened.recovery).toEqual({ savedAt: T0 - MINUTE, handoff: null, showId: null });
    // Counts start empty until the recovery is settled
    expect(ctx.session.state().hasPlayed).toBe(false);
  });

  it('restore returns the counts with the saved show when there is no layout record', async () => {
    const ctx = setup();
    ctx.recoveryStore.played.set('Alice', playedRecord({ 12: 2 }));
    const opened = await ctx.session.open();

    // A play before the recovery is settled must not replace the pending file
    await expect(ctx.session.recordPlay('5')).resolves.toMatchObject({ skipped: true });
    await expect(ctx.session.resolveRecovery('restore')).resolves.toEqual({ layout: layoutWith(1), counts: { 12: 2 } });
    ctx.session.reportReady(opened.generation, true);

    // The saved show is on screen, so nothing is unsaved
    expect(ctx.session.state()).toMatchObject({ dirty: false, hasPlayed: true });
    await ctx.session.recordPlay('12');
    expect(ctx.recoveryStore.played.get('Alice').counts).toEqual({ 12: 3 });
  });

  it('restore returns the layout record and the counts together', async () => {
    const ctx = setup();
    ctx.recoveryStore.records.set('Alice', {
      version: 1, showId: ctx.doc.activeShowId, savedAt: T0 - 2 * MINUTE, handoff: null, layout: layoutWith(9),
    });
    ctx.recoveryStore.played.set('Alice', playedRecord({ 12: 1 }));
    const opened = await ctx.session.open();
    // The later of the two times
    expect(opened.recovery.savedAt).toBe(T0 - MINUTE);

    await expect(ctx.session.resolveRecovery('restore')).resolves.toEqual({ layout: layoutWith(9), counts: { 12: 1 } });
    ctx.session.reportReady(opened.generation, true);
    expect(ctx.session.state().dirty).toBe(true);
  });

  it('discard clears both the layout record and the played file', async () => {
    const ctx = setup();
    ctx.recoveryStore.records.set('Alice', {
      version: 1, showId: ctx.doc.activeShowId, savedAt: T0, handoff: null, layout: layoutWith(9),
    });
    ctx.recoveryStore.played.set('Alice', playedRecord({ 12: 1 }));
    await ctx.session.open();

    await expect(ctx.session.resolveRecovery('discard')).resolves.toEqual({ layout: layoutWith(1), counts: {} });
    expect(ctx.recoveryStore.records.has('Alice')).toBe(false);
    expect(ctx.recoveryStore.played.has('Alice')).toBe(false);
    expect(ctx.session.state().hasPlayed).toBe(false);
  });

  it('a layout equal to the saved show retires the layout record but leaves the played file', async () => {
    const ctx = setup();
    await readyWithoutRecovery(ctx);
    await ctx.session.recordPlay('12');
    await ctx.session.saveRecovery(layoutWith(9));

    await expect(ctx.session.saveRecovery(layoutWith(1))).resolves.toMatchObject({ retired: true });

    expect(ctx.recoveryStore.records.has('Alice')).toBe(false);
    expect(ctx.recoveryStore.played.get('Alice').counts).toEqual({ 12: 1 });
  });

  it('a show switch, Revert and Save keep the counts', async () => {
    const ctx = setup({ doc: twoShowDoc() });
    const opened = await readyWithoutRecovery(ctx);
    await ctx.session.recordPlay('12');

    const switched = await ctx.session.activate('show-2');
    expect(ctx.session.state().hasPlayed).toBe(true);
    // Plays while the next show loads still count
    await ctx.session.recordPlay('12');
    ctx.session.reportReady(switched.generation, true);
    const reverted = await ctx.session.revert();
    ctx.session.reportReady(reverted.generation, true);
    await ctx.session.updateActive(layoutWith(5));

    expect(opened.generation).not.toBe(reverted.generation);
    expect(ctx.recoveryStore.played.get('Alice').counts).toEqual({ 12: 2 });
    expect(ctx.recoveryStore.retirePlayed).not.toHaveBeenCalled();
  });

  it('a profile switch clears the counts; the next profile starts fresh', async () => {
    const ctx = setup({ profiles: ['Alice', 'Bob'] });
    await readyWithoutRecovery(ctx);
    await ctx.session.recordPlay('12');

    await ctx.session.end('switch');
    expect(ctx.recoveryStore.played.has('Alice')).toBe(false);
    expect(ctx.session.state().hasPlayed).toBe(false);

    ctx.current.profile = 'Bob';
    const opened = await ctx.session.open();
    expect(opened.recovery).toBeNull();
    expect(ctx.session.state().hasPlayed).toBe(false);
  });

  it('every exit that retires the layout record retires the played file; library import clears all', async () => {
    for (const reason of ['clean-exit', 'switch', 'backup-restore', 'profile-deleted', 'library-import']) {
      const ctx = setup();
      await readyWithoutRecovery(ctx);
      await ctx.session.recordPlay('12');
      await ctx.session.end(reason);
      expect(ctx.recoveryStore.played.has('Alice'), reason).toBe(false);
    }
  });

  it('a played-only file pending at the prompt is kept by a clean exit, as the layout record is', async () => {
    const ctx = setup();
    ctx.recoveryStore.played.set('Alice', playedRecord({ 12: 2 }));
    await ctx.session.open();
    ctx.session.rendererGone();
    await ctx.session.end('clean-exit');
    expect(ctx.recoveryStore.played.get('Alice')).toEqual(playedRecord({ 12: 2 }));
  });

  it('a quit while a show change loads retires the counts', async () => {
    const ctx = setup({ doc: twoShowDoc() });
    await readyWithoutRecovery(ctx);
    await ctx.session.recordPlay('12');
    await ctx.session.activate('show-2');
    expect(ctx.session.state().status).toBe('loading');
    await ctx.session.end('clean-exit');
    expect(ctx.recoveryStore.played.has('Alice')).toBe(false);
  });

  for (const [name, handOff] of [
    ['an update handoff', (session) => session.handoff('update')],
    ['a renderer crash', (session) => session.rendererGone()],
  ]) {
    it(`${name} restores the counts silently, with or without a layout change`, async () => {
      const ctx = setup();
      await readyWithoutRecovery(ctx);
      await ctx.session.recordPlay('12');
      await ctx.session.recordPlay('12');

      await handOff(ctx.session);
      // Handed off: a late play from the old page can't land
      await expect(ctx.session.recordPlay('12')).resolves.toMatchObject({ skipped: true });
      await ctx.session.end('clean-exit');
      expect(ctx.recoveryStore.played.get('Alice')).toMatchObject({ handoff: expect.any(String), counts: { 12: 2 } });

      const opened = await ctx.session.open();
      expect(opened.recovery.handoff).not.toBeNull();
      await expect(ctx.session.resolveRecovery('restore')).resolves.toEqual({ layout: layoutWith(1), counts: { 12: 2 } });
      // Spent once restored: another crash before any change must ask
      expect(ctx.recoveryStore.played.get('Alice')).toMatchObject({ handoff: null, counts: { 12: 2 } });
    });
  }

  for (const [name, loadError] of [
    ['a failed', new ShowStoreError('version')],
    ['an unreadable', new ShowStoreError('unreadable')],
  ]) {
    it(`${name} open never overwrites or retires a crash's played file`, async () => {
      for (const reason of ['clean-exit', 'switch']) {
        const ctx = setup({ loadError });
        ctx.recoveryStore.played.set('Alice', playedRecord({ 12: 2 }));
        await ctx.session.open();
        await expect(ctx.session.recordPlay('5')).resolves.toMatchObject({ skipped: true });
        await expect(ctx.session.clearPlayed(null)).resolves.toMatchObject({ skipped: true });
        await ctx.session.end(reason);
        expect(ctx.recoveryStore.played.get('Alice'), reason).toEqual(playedRecord({ 12: 2 }));
      }
    });
  }

  it('an unreadable store started empty settles the played file like open(): restore or discard', async () => {
    const ctx = setup({ loadError: new ShowStoreError('unreadable') });
    ctx.recoveryStore.played.set('Alice', playedRecord({ 12: 2 }));
    await ctx.session.open();
    const empty = await ctx.session.startEmpty();
    expect(empty.recovery).toMatchObject({ showId: null });
    await expect(ctx.session.recordPlay('5')).resolves.toMatchObject({ skipped: true });
    await expect(ctx.session.resolveRecovery('restore')).resolves.toMatchObject({ counts: { 12: 2 } });
    await expect(ctx.session.recordPlay('5')).resolves.toEqual({ count: 1 });

    // With nothing pending, starting empty settles at once
    const plain = setup({ loadError: new ShowStoreError('unreadable') });
    await plain.session.open();
    await plain.session.startEmpty();
    await expect(plain.session.recordPlay('5')).resolves.toEqual({ count: 1 });
  });

  it('plays are refused while a layout record waits at the prompt, even without a played file', async () => {
    const ctx = setup();
    ctx.recoveryStore.records.set('Alice', {
      version: 1, showId: ctx.doc.activeShowId, savedAt: T0, handoff: null, layout: layoutWith(9),
    });
    await ctx.session.open();
    await expect(ctx.session.recordPlay('5')).resolves.toMatchObject({ skipped: true });
    await ctx.session.resolveRecovery('restore');
    await expect(ctx.session.recordPlay('5')).resolves.toEqual({ count: 1 });
  });

  it('discard always sets the played file aside', async () => {
    const ctx = setup();
    ctx.recoveryStore.records.set('Alice', {
      version: 1, showId: ctx.doc.activeShowId, savedAt: T0, handoff: null, layout: layoutWith(9),
    });
    await ctx.session.open();
    await ctx.session.resolveRecovery('discard');
    expect(ctx.recoveryStore.discard).toHaveBeenCalledWith('Alice');
  });

  it('resolveRecovery discard keeps the record and the played counts as discarded copies, retiring neither', async () => {
    const ctx = setup();
    const record = { version: 1, showId: ctx.doc.activeShowId, savedAt: T0, handoff: null, layout: layoutWith(9) };
    ctx.recoveryStore.records.set('Alice', record);
    ctx.recoveryStore.played.set('Alice', playedRecord({ 12: 1 }));
    await ctx.session.open();
    await ctx.session.resolveRecovery('discard');
    expect(ctx.recoveryStore.discarded.get('Alice')).toEqual({ record, played: playedRecord({ 12: 1 }) });
    expect(ctx.recoveryStore.retire).not.toHaveBeenCalled();
    expect(ctx.recoveryStore.retirePlayed).not.toHaveBeenCalled();
  });

  it('rejects an invalid song id', async () => {
    const ctx = setup();
    await readyWithoutRecovery(ctx);
    await expect(ctx.session.recordPlay('abc')).rejects.toThrow('Invalid song id');
    await expect(ctx.session.clearPlayed('1x')).rejects.toThrow('Invalid song id');
  });
});
