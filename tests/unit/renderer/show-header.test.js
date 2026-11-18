import { beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.window = globalThis.window || {};
window.debugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const { refreshHeader, setHeaderLabels, setDirty, installHeaderListeners } = await import('../../../src/renderer/modules/shows/header.js');

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
const dotShown = () => !els.dirty.hidden;

function resetDom() {
  els = { profile: element(), separator: element(), icon: element(), show: element(), dirty: element() };
  els.dirty.hidden = true;
  const byId = { 'profile-name': els.profile, 'show-icon': els.icon, 'show-name': els.show, 'show-dirty': els.dirty };
  doc = {
    documentElement: { dataset: {} },
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

describe('setDirty', () => {
  beforeEach(() => { resetDom(); });

  it('shows the dot after the show name only while dirty', () => {
    setHeaderLabels({ profile: 'Default User', show: 'Main' }, doc);
    expect(dotShown()).toBe(false);
    setDirty(true, doc);
    expect(dotShown()).toBe(true);
    // The name itself is unchanged
    expect(show().textContent).toBe('Main');
    setDirty(false, doc);
    expect(dotShown()).toBe(false);
  });

  it('never shows the dot without a show, and hides it when the show goes', () => {
    setHeaderLabels({ profile: 'Default User', show: null }, doc);
    setDirty(true, doc);
    expect(dotShown()).toBe(false);

    setHeaderLabels({ show: 'Main' }, doc);
    setDirty(true, doc);
    setHeaderLabels({ show: null }, doc);
    expect(dotShown()).toBe(false);
  });

  it('follows the show-dirty-changed event once installed, installing only once', () => {
    const target = { addEventListener: vi.fn() };
    installHeaderListeners({ target, doc });
    installHeaderListeners({ target, doc });
    expect(target.addEventListener).toHaveBeenCalledOnce();
    const [type, listener] = target.addEventListener.mock.calls[0];
    expect(type).toBe('show-dirty-changed');

    setHeaderLabels({ show: 'Main' }, doc);
    listener({ detail: { dirty: true } });
    expect(dotShown()).toBe(true);
    listener({ detail: { dirty: false } });
    expect(dotShown()).toBe(false);
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
    expect(dotShown()).toBe(false);
  });

  it('shows the dot when the session is dirty, and clears it when not', async () => {
    const showDoc = { activeShowId: 'b1', shows: [{ id: 'b1', name: 'One' }] };
    await refreshHeader({ doc, api: api({ profile: 'Default User', status: 'ready', doc: showDoc, dirty: true }) });
    expect(dotShown()).toBe(true);
    await refreshHeader({ doc, api: api({ profile: 'Default User', status: 'ready', doc: showDoc, dirty: false }) });
    expect(dotShown()).toBe(false);
  });

  it('shows no dot while the session is not ready, even if it says dirty', async () => {
    const showDoc = { activeShowId: 'b1', shows: [{ id: 'b1', name: 'One' }] };
    for (const status of ['loading', 'failed']) {
      await refreshHeader({ doc, api: api({ profile: 'Default User', status, doc: showDoc, dirty: true }) });
      expect(dotShown(), status).toBe(false);
    }
  });

  it('shows no show when the session has no document', async () => {
    await refreshHeader({ doc, api: api({ profile: 'Default User', status: 'failed', doc: null }) });
    expect(hiddenParts()).toEqual([true, true, true]);
    expect(els.profile.textContent).toBe('Default User');
  });

  it('applies the active show\'s color to <html>, and removes it for an uncolored or missing show', async () => {
    const showDoc = { activeShowId: 'b2', shows: [{ id: 'b1', name: 'One' }, { id: 'b2', name: 'Two', color: 'teal' }] };
    await refreshHeader({ doc, api: api({ profile: 'Default User', status: 'ready', doc: showDoc }) });
    expect(doc.documentElement.dataset.showColor).toBe('teal');
    await refreshHeader({ doc, api: api({ profile: 'Default User', status: 'ready', doc: { ...showDoc, activeShowId: 'b1' } }) });
    expect('showColor' in doc.documentElement.dataset).toBe(false);
    await refreshHeader({ doc, api: api({ profile: 'Default User', status: 'ready', doc: showDoc }) });
    await refreshHeader({ doc, api: api({ profile: 'Default User', status: 'failed', doc: null }) });
    expect('showColor' in doc.documentElement.dataset).toBe(false);
    // A state that can't be read leaves the color as it was
    await refreshHeader({ doc, api: api({ profile: 'Default User', status: 'ready', doc: showDoc }) });
    await refreshHeader({ doc, api: api(null, false) });
    expect(doc.documentElement.dataset.showColor).toBe('teal');
  });

  it('never throws when the state cannot be read', async () => {
    await expect(refreshHeader({ doc, api: api(null, false) })).resolves.toBeUndefined();
    await expect(refreshHeader({ doc, api: { getState: vi.fn(async () => { throw new Error('boom'); }) } })).resolves.toBeUndefined();
  });
});
