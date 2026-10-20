import { describe, expect, it } from 'vitest';
import * as bd from '../../../src/main/modules/show-document.js';

const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
};

const makeIds = () => {
  let n = 0;
  return () => `id-${++n}`;
};
const NOW = 1000;

const mk = (names = ['A']) => {
  const newId = makeIds();
  let doc = bd.createDocument(bd.emptyLayout(), { name: names[0], now: NOW, newId });
  for (const name of names.slice(1)) {
    doc = bd.addShow(doc, { name, layout: bd.emptyLayout(), now: NOW, newId, activate: false }).doc;
  }
  return { doc, newId };
};

describe('show-document', () => {
  it('createDocument makes one active show named "Default Show"', () => {
    const doc = bd.createDocument(bd.emptyLayout(), { now: NOW, newId: makeIds() });
    expect(doc.version).toBe(1);
    expect(doc.shows).toHaveLength(1);
    expect(doc.shows[0].name).toBe('Default Show');
    expect(doc.activeShowId).toBe(doc.shows[0].id);
    expect(doc.shows[0].createdAt).toBe(NOW);
    expect(doc.shows[0].updatedAt).toBe(NOW);
    expect(bd.SHOW_DOCUMENT_VERSION).toBe(1);
  });

  it('validateShowName rejects empty, >50 chars, and case-insensitive duplicates', () => {
    const { doc } = mk(['Comedy Sports']);
    expect(bd.validateShowName(doc, '   ')).toEqual({ ok: false, error: 'Enter a name for the show.' });
    expect(bd.validateShowName(doc, 'x'.repeat(51))).toEqual({
      ok: false,
      error: 'Show names can be at most 50 characters.',
    });
    expect(bd.validateShowName(doc, 'comedy sports')).toEqual({
      ok: false,
      error: 'A show with this name already exists.',
    });
    expect(bd.validateShowName(doc, '  Fresh  ')).toEqual({ ok: true, name: 'Fresh' });
    expect(bd.validateShowName(doc, 'x'.repeat(50)).ok).toBe(true);
  });

  it('validateShowName rejects line breaks and other control characters', () => {
    const { doc } = mk(['Comedy Sports']);
    const error = "Show names can't contain line breaks or control characters.";
    for (const name of ['Act\nTwo', 'Act\rTwo', 'Act\tTwo', 'Bell\u0007', 'Del\u007F']) {
      expect(bd.validateShowName(doc, name)).toEqual({ ok: false, error });
    }
    expect(bd.validateShowName(doc, 'Act Two – Finale').ok).toBe(true);
  });

  it('addShow and renameShow name errors carry code invalid-name', () => {
    const { doc } = mk(['Comedy Sports']);
    const caught = (fn) => { try { fn(); } catch (error) { return error; } return null; };
    const added = caught(() => bd.addShow(doc, { name: 'comedy sports', layout: null }));
    expect(added).toMatchObject({ message: 'A show with this name already exists.', code: 'invalid-name' });
    const renamed = caught(() => bd.renameShow(doc, doc.shows[0].id, ' '));
    expect(renamed).toMatchObject({ message: 'Enter a name for the show.', code: 'invalid-name' });
    // Other errors have no code
    expect(caught(() => bd.renameShow(doc, 'nope', 'X')).code).toBeUndefined();
  });

  it('validateShowName allows renaming a show to a different casing of itself', () => {
    const { doc } = mk(['Comedy Sports']);
    const id = doc.shows[0].id;
    expect(bd.validateShowName(doc, 'COMEDY SPORTS', { exceptId: id })).toEqual({
      ok: true,
      name: 'COMEDY SPORTS',
    });
    const renamed = bd.renameShow(doc, id, 'COMEDY SPORTS', 2000);
    expect(renamed.shows[0].name).toBe('COMEDY SPORTS');
    expect(renamed.shows[0].updatedAt).toBe(2000);
  });

  it('renameShow throws the validation message and Show not found', () => {
    const { doc } = mk(['A', 'B']);
    expect(() => bd.renameShow(doc, doc.shows[0].id, 'b', 5)).toThrow(
      'A show with this name already exists.'
    );
    expect(() => bd.renameShow(doc, 'nope', 'Z', 5)).toThrow('Show not found.');
    expect(() => bd.updateShowLayout(doc, 'nope', bd.emptyLayout(), 5)).toThrow('Show not found.');
    expect(() => bd.deleteShow(doc, 'nope', { now: 5, newId: makeIds() })).toThrow('Show not found.');
    expect(() => bd.setActive(doc, 'nope')).toThrow('Show not found.');
  });

  it('deleting a non-active show keeps the active id', () => {
    const { doc, newId } = mk(['A', 'B', 'C']);
    const r = bd.deleteShow(doc, doc.shows[1].id, { now: 5, newId });
    expect(r.activeChanged).toBe(false);
    expect(r.doc.activeShowId).toBe(doc.activeShowId);
    expect(r.nextActiveId).toBe(doc.activeShowId);
    expect(r.doc.shows.map((b) => b.name)).toEqual(['A', 'C']);
  });

  it('deleting the active show activates the next in creation order', () => {
    const { doc, newId } = mk(['A', 'B', 'C']);
    const d = bd.setActive(doc, doc.shows[1].id);
    const r = bd.deleteShow(d, doc.shows[1].id, { now: 5, newId });
    expect(r.activeChanged).toBe(true);
    expect(r.nextActiveId).toBe(doc.shows[2].id);
    expect(r.doc.activeShowId).toBe(doc.shows[2].id);
  });

  it('deleting the last show in the list activates the previous', () => {
    const { doc, newId } = mk(['A', 'B', 'C']);
    const d = bd.setActive(doc, doc.shows[2].id);
    const r = bd.deleteShow(d, doc.shows[2].id, { now: 5, newId });
    expect(r.nextActiveId).toBe(doc.shows[1].id);
    expect(r.doc.activeShowId).toBe(doc.shows[1].id);
  });

  it('deleting the only show leaves one empty "Default Show"', () => {
    const { doc, newId } = mk(['Solo']);
    const r = bd.deleteShow(doc, doc.shows[0].id, { now: 7, newId });
    expect(r.activeChanged).toBe(true);
    expect(r.doc.shows).toHaveLength(1);
    expect(r.doc.shows[0].name).toBe('Default Show');
    expect(r.doc.shows[0].id).not.toBe(doc.shows[0].id);
    expect(r.doc.shows[0].layout).toEqual(bd.emptyLayout());
    expect(r.doc.activeShowId).toBe(r.doc.shows[0].id);
    expect(r.nextActiveId).toBe(r.doc.shows[0].id);
  });

  it('addShow activates by default, can skip, and records importedFrom', () => {
    const { doc, newId } = mk(['A']);
    const importedFrom = { profile: 'Derek', showId: 'x', showName: 'Y', at: 3 };
    const r = bd.addShow(doc, { name: ' B ', layout: bd.emptyLayout(), now: 9, newId, importedFrom });
    expect(r.show.name).toBe('B');
    expect(r.show.importedFrom).toEqual(importedFrom);
    expect(r.doc.activeShowId).toBe(r.show.id);
    const r2 = bd.addShow(r.doc, { name: 'C', layout: bd.emptyLayout(), now: 9, newId, activate: false });
    expect(r2.doc.activeShowId).toBe(r.show.id);
    expect(r2.doc.shows.map((b) => b.name)).toEqual(['A', 'B', 'C']);
    expect(() => bd.addShow(r2.doc, { name: 'a', layout: bd.emptyLayout(), now: 9, newId })).toThrow(
      'A show with this name already exists.'
    );
  });

  it('importName suffixes on collision', () => {
    const { doc } = mk(['Comedy Sports (Derek)']);
    expect(bd.importName(doc, 'Comedy Sports', 'Derek')).toBe('Comedy Sports (Derek) 2');
    expect(bd.importName(doc, 'Other', 'Derek')).toBe('Other (Derek)');
    const { doc: d2 } = mk(['X (Derek)', 'X (Derek) 2']);
    expect(bd.importName(d2, 'x', 'Derek')).toBe('x (Derek) 3');
  });

  it('importName keeps & and quotes verbatim', () => {
    const { doc } = mk(['A']);
    expect(bd.importName(doc, 'Mom & "Pop"', 'Derek')).toBe('Mom & "Pop" (Derek)');
  });

  it('importName clips the show part to stay within 50 characters', () => {
    const { doc } = mk(['A']);
    const name = bd.importName(doc, 'b'.repeat(60), 'Derek');
    expect(name.length).toBe(50);
    expect(name.endsWith(' (Derek)')).toBe(true);
    const { doc: d2 } = mk([name]);
    const second = bd.importName(d2, 'b'.repeat(60), 'Derek');
    expect(second.length).toBeLessThanOrEqual(50);
    expect(second.endsWith(' (Derek) 2')).toBe(true);
    expect(bd.validateShowName(d2, second).ok).toBe(true);
  });

  it('importName terminates and stays within 50 chars for very long profiles', () => {
    const { doc } = mk(['A']);
    const profile = 'p'.repeat(50);
    const first = bd.importName(doc, 'Show', profile);
    expect(first.length).toBeLessThanOrEqual(50);
    expect(first).toContain('…');
    const { doc: d2 } = mk(['A', first]);
    const second = bd.importName(d2, 'Show', profile);
    expect(second).not.toBe(first);
    expect(second.length).toBeLessThanOrEqual(50);
    expect(second).toContain('…');
    expect(second.endsWith(' 2')).toBe(true);
    expect(bd.validateShowName(d2, second).ok).toBe(true);
  });

  it('importName trims leading spaces and throws when no name is free', () => {
    const { doc } = mk(['A']);
    expect(bd.importName(doc, '   Show  ', 'Derek')).toBe('Show (Derek)');
    const names = ['Show (Derek)', ...Array.from({ length: 999 }, (_, i) => `Show (Derek) ${i + 2}`)];
    const { doc: full } = mk(names);
    expect(() => bd.importName(full, 'Show', 'Derek')).toThrow(
      'Could not find a free name for the imported show.'
    );
  });

  it('parseDocument handles version edge cases and duplicate ids', () => {
    const { doc } = mk(['A', 'B']);
    expect(bd.parseDocument({ ...doc, version: '2' })).toEqual({ ok: false, error: 'version' });
    const { version, ...noVersion } = doc;
    expect(bd.parseDocument(noVersion)).toEqual({ ok: false, error: 'shape' });
    for (const v of ['x', NaN, 1.5, 0]) {
      expect(bd.parseDocument({ ...doc, version: v })).toEqual({ ok: false, error: 'shape' });
    }
    const dup = { ...doc, shows: [doc.shows[0], { ...doc.shows[1], id: doc.shows[0].id }] };
    expect(bd.parseDocument(dup)).toEqual({ ok: false, error: 'shape' });
  });

  it('normalizeLayout pads to 5 tabs and drops non-numeric ids', () => {
    const l = bd.normalizeLayout({
      hotkeys: [
        { tabNumber: 3, tabName: 'Three', hotkeys: { f1: '12', f2: 'abc', f13: '5', f12: 7, f3: '9' } },
        { tabNumber: 9, tabName: 'Out', hotkeys: { f1: '1' } },
      ],
      holdingTank: [{ tabNumber: 2, tabName: null, songIds: ['1', 'x', 2, '3'] }],
      selected: { hotkeyTab: 4, holdingTankTab: 9 },
    });
    expect(l.hotkeys.map((t) => t.tabNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(l.holdingTank.map((t) => t.tabNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(l.hotkeys[0]).toEqual({ tabNumber: 1, tabName: null, hotkeys: {} });
    expect(l.hotkeys[2]).toEqual({ tabNumber: 3, tabName: 'Three', hotkeys: { f1: '12', f3: '9' } });
    expect(l.holdingTank[1].songIds).toEqual(['1', '3']);
    expect(l.holdingTank[0]).toEqual({ tabNumber: 1, tabName: null, songIds: [] });
    expect(l.selected).toEqual({ hotkeyTab: 4, holdingTankTab: 1 });
    expect(bd.normalizeLayout(null)).toEqual(bd.emptyLayout());
    expect(bd.emptyLayout().selected).toEqual({ hotkeyTab: 1, holdingTankTab: 1 });
  });

  it('parseDocument rejects version 2 as "version"', () => {
    const { doc } = mk(['A']);
    expect(bd.parseDocument({ ...doc, version: 2 })).toEqual({ ok: false, error: 'version' });
  });

  it('parseDocument rejects bad shapes and normalizes layouts', () => {
    const { doc } = mk(['A']);
    for (const bad of [null, 'x', {}, { version: 1, shows: [] }, { ...doc, shows: 'no' },
      { ...doc, activeShowId: 'zzz' }]) {
      expect(bd.parseDocument(bad)).toEqual({ ok: false, error: 'shape' });
    }
    const r = bd.parseDocument({
      ...doc,
      shows: [{ ...doc.shows[0], layout: { hotkeys: [], holdingTank: [] } }],
    });
    expect(r.ok).toBe(true);
    expect(r.doc.shows[0].layout.hotkeys).toHaveLength(5);
  });

  it('never mutates its input', () => {
    const { doc } = mk(['A', 'B']);
    const frozen = deepFreeze(structuredClone(doc));
    const newId = makeIds();
    const layout = deepFreeze(bd.emptyLayout());
    const id = frozen.shows[0].id;
    expect(() => {
      bd.addShow(frozen, { name: 'C', layout, now: 1, newId });
      bd.updateShowLayout(frozen, id, layout, 2);
      bd.renameShow(frozen, id, 'Z', 3);
      bd.deleteShow(frozen, id, { now: 4, newId });
      bd.setActive(frozen, frozen.shows[1].id);
      bd.importName(frozen, 'A', 'P');
      bd.parseDocument(frozen);
      bd.normalizeLayout(layout);
    }).not.toThrow();
  });
});
