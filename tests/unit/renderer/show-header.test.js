import { beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.window = globalThis.window || {};
window.debugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const { refreshHeader, setHeaderLabels } = await import('../../../src/renderer/modules/shows/header.js');

// No DOM library: elements that record textContent and refuse innerHTML
function element() {
  const attrs = {};
  return {
    hidden: false,
    textContent: '',
    get title() { return attrs.title ?? ''; },
    set title(value) { attrs.title = value; },
    removeAttribute: (name) => { delete attrs[name]; },
    set innerHTML(_) { throw new Error('innerHTML must not be used'); }
  };
}

let els;
let doc;
const show = () => els.show;
const hiddenParts = () => [els.separator, els.icon, els.show].map((el) => el.hidden);

function resetDom() {
  els = { profile: element(), separator: element(), icon: element(), show: element() };
  const byId = { 'profile-name': els.profile, 'show-icon': els.icon, 'show-name': els.show };
  doc = {
    getElementById: (id) => byId[id] ?? null,
    querySelector: (selector) => (selector === '.show-separator' ? els.separator : null)
  };
}

describe('setHeaderLabels', () => {
  beforeEach(() => { resetDom(); });

  it('shows profile and show, full name in title', () => {
    setHeaderLabels({ profile: 'Default User', show: 'Friday Show' }, doc);
    expect(els.profile.textContent).toBe('Default User');
    expect(show().textContent).toBe('Friday Show');
    expect(show().title).toBe('Friday Show');
    expect(hiddenParts()).toEqual([false, false, false]);
  });

  it('uses textContent, never innerHTML', () => {
    setHeaderLabels({ profile: '<i>p</i>', show: '<b>x</b>' }, doc);
    expect(show().textContent).toBe('<b>x</b>');
    expect(show().innerHTML).toBeUndefined();
      });

  it('hides the separator, icon and name without a show', () => {
    setHeaderLabels({ profile: 'Default User', show: 'Main' }, doc);
    setHeaderLabels({ profile: 'Default User', show: null }, doc);
    expect(hiddenParts()).toEqual([true, true, true]);
    expect(show().textContent).toBe('');
    expect(els.profile.textContent).toBe('Default User');
  });

  it('leaves the profile alone when none is given', () => {
    setHeaderLabels({ profile: 'Default User' }, doc);
    setHeaderLabels({ show: 'Main' }, doc);
    expect(els.profile.textContent).toBe('Default User');
  });
});

describe('refreshHeader', () => {
  beforeEach(() => { resetDom(); });
  const api = (data, success = true) => ({ getState: vi.fn(async () => (success ? { success, data } : { success, error: 'x' })) });

  it('shows the active show from the session state', async () => {
    const showDoc = { activeShowId: 'b2', shows: [{ id: 'b1', name: 'One' }, { id: 'b2', name: 'Two' }] };
    await refreshHeader({ doc, api: api({ profile: 'Default User', status: 'ready', doc: showDoc }) });
    expect(show().textContent).toBe('Two');
    expect(els.profile.textContent).toBe('Default User');
  });

  it('shows no show when the session has no document', async () => {
    await refreshHeader({ doc, api: api({ profile: 'Default User', status: 'failed', doc: null }) });
    expect(hiddenParts()).toEqual([true, true, true]);
    expect(els.profile.textContent).toBe('Default User');
  });

  it('never throws when the state cannot be read', async () => {
    await expect(refreshHeader({ doc, api: api(null, false) })).resolves.toBeUndefined();
    await expect(refreshHeader({ doc, api: { getState: vi.fn(async () => { throw new Error('boom'); }) } })).resolves.toBeUndefined();
  });
});
