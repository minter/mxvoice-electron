import { beforeEach, describe, expect, it, vi } from 'vitest';

// No jsdom here: a small fake DOM with just what played-pills.js uses, and a
// MutationObserver whose records the test delivers by hand.

const observers = [];
class FakeMutationObserver {
  constructor(callback) { this.callback = callback; this.roots = []; this.queue = []; observers.push(this); }
  observe(root, options) { this.roots.push({ root, options }); }
  record(record) {
    if (this.roots.some(({ root }) => root.contains(record.target))) this.queue.push(record);
  }
}
const notify = (record) => observers.forEach((o) => o.record({ addedNodes: [], ...record }));

/** Deliver pending records until none are left; returns how many passes ran. */
function deliver() {
  let passes = 0;
  while (observers.some((o) => o.queue.length) && passes < 20) {
    passes += 1;
    for (const o of observers) {
      const records = o.queue.splice(0);
      if (records.length) o.callback(records);
    }
  }
  return passes;
}

function matchesCompound(el, compound) {
  if (compound === ':scope') return true;
  const tag = compound.match(/^[a-z]+/)?.[0];
  if (tag && el.tagName !== tag) return false;
  for (const [, kind, name] of compound.matchAll(/([#.])([\w-]+)/g)) {
    if (kind === '#' ? el.id !== name : !el.classList.contains(name)) return false;
  }
  for (const [, name, value] of compound.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
    if (!el.attributes.has(name) || (value !== undefined && el.attributes.get(name) !== value)) return false;
  }
  return true;
}

// Right to left over "a b > c"; `scope` stands for :scope
function matchesComplex(el, selector, scope) {
  const parts = selector.trim().split(/\s*(>)\s*|\s+/).filter(Boolean);
  const step = (node, i) => {
    const compound = parts[i];
    if (compound === ':scope' ? node !== scope : !matchesCompound(node, compound)) return false;
    if (i === 0) return true;
    if (parts[i - 1] === '>') return node.parent ? step(node.parent, i - 2) : false;
    for (let up = node.parent; up; up = up.parent) if (step(up, i - 1)) return true;
    return false;
  };
  return step(el, parts.length - 1);
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.nodeType = 1;
    this.attributes = new Map();
    this.children = [];
    this.parent = null;
    this.dataset = {};
    this.style = {};
    this.id = '';
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((n) => classes.add(n)),
      contains: (n) => classes.has(n),
    };
    Object.defineProperty(this, 'className', { set: (v) => { classes.clear(); v.split(/\s+/).filter(Boolean).forEach((n) => classes.add(n)); } });
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'id') this.id = String(value);
    notify({ type: 'attributes', target: this, attributeName: name });
  }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) {
    this.attributes.delete(name);
    notify({ type: 'attributes', target: this, attributeName: name });
  }
  insert(child, index) {
    child.parent?.removeChild(child);
    child.parent = this;
    this.children.splice(index, 0, child);
    notify({ type: 'childList', target: this, addedNodes: [child] });
  }
  append(child) { this.insert(child, this.children.length); }
  appendChild(child) { this.append(child); }
  prepend(child) { this.insert(child, 0); }
  removeChild(child) {
    this.children = this.children.filter((c) => c !== child);
    child.parent = null;
    notify({ type: 'childList', target: this, removedNodes: [child] });
  }
  remove() { this.parent?.removeChild(this); }
  set textContent(text) {
    this.children.forEach((c) => { c.parent = null; });
    this.children = [];
    this.text = text;
    notify({ type: 'childList', target: this });
  }
  contains(node) { for (let n = node; n; n = n.parent) if (n === this) return true; return false; }
  descendants() { return this.children.flatMap((c) => [c, ...c.descendants()]); }
  matches(selector) { return selector.split(',').some((s) => matchesComplex(this, s, null)); }
  closest(selector) { for (let n = this; n; n = n.parent) if (n.matches(selector)) return n; return null; }
  querySelectorAll(selector) {
    return this.descendants().filter((el) => selector.split(',').some((s) => matchesComplex(el, s, this)));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  cloneNode() {
    const copy = new FakeElement(this.tagName);
    this.attributes.forEach((v, k) => copy.attributes.set(k, v));
    copy.id = this.id;
    copy.text = this.text;
    for (const child of this.children) {
      const c = child.cloneNode();
      c.parent = copy;
      copy.children.push(c);
    }
    return copy;
  }
}

const el = (tag, { id, className, attrs = {} } = {}, children = []) => {
  const node = new FakeElement(tag);
  if (id) node.id = id;
  if (className) node.className = className;
  Object.entries(attrs).forEach(([k, v]) => node.attributes.set(k, v));
  children.forEach((c) => { c.parent = node; node.children.push(c); });
  return node;
};

// The three surfaces, as index.html has them
const hotkeySlot = (n) => el('li', { id: `f${n}_hotkey`, className: 'list-group-item' }, [el('div', { className: 'badge' }), el('span', { className: 'song' })]);
const hotkeyList = el('ul', { id: 'hotkeys_list_1', className: 'hotkeys' }, [hotkeySlot(1), hotkeySlot(2)]);
const hotkeyRoot = el('div', { id: 'hotkey-tab-content' }, [hotkeyList]);
const tankList = el('ul', { id: 'holding_tank_1', className: 'holding_tank' });
const tankRoot = el('div', { id: 'holding-tank-tab-content' }, [tankList]);
const tbody = el('tbody');
const searchTable = el('table', { id: 'search_results' }, [tbody]);
const body = el('body', {}, [hotkeyRoot, tankRoot, searchTable]);

const events = new EventTarget();
globalThis.window = {
  addEventListener: (...args) => events.addEventListener(...args),
  dispatchEvent: (event) => events.dispatchEvent(event),
  secureElectronAPI: { shows: { recordPlay: vi.fn(async () => ({ success: true })), clearPlayed: vi.fn(async () => ({ success: true })) } },
  debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
};
globalThis.MutationObserver = FakeMutationObserver;
globalThis.document = {
  createElement: (tag) => new FakeElement(tag),
  getElementById: (id) => body.descendants().find((n) => n.id === id) ?? null,
  querySelectorAll: (selector) => body.querySelectorAll(selector),
};

const played = await import('../../../src/renderer/modules/shows/played-counts.js');
const { appendPlayedPill, installPlayedPills } = await import('../../../src/renderer/modules/shows/played-pills.js');

const pillOf = (host) => host.children.find((c) => c.classList.contains('played-pill')) ?? null;
const slot = (n) => hotkeyList.children[n - 1];

function tankRow(songId) {
  const li = el('li', { className: 'song list-group-item', attrs: { songid: songId } });
  tankList.append(li);
  return li;
}

function searchCell(songId) {
  const td = el('td');
  appendPlayedPill(td, songId);
  tbody.append(el('tr', { attrs: { songid: songId } }, [el('td'), el('td'), td]));
  return td;
}

installPlayedPills();
played.load({});
deliver();

describe('played pills', () => {
  beforeEach(() => {
    played.load({});
    deliver();
  });

  it('puts the pill after the hotkey name, after a holding tank title, and at the end of a search title', () => {
    slot(1).setAttribute('songid', '12');
    const row = tankRow('12');
    deliver();
    played.recordPlay('12');
    const td = searchCell('12');

    expect(slot(1).children.at(-1)).toBe(pillOf(slot(1)));
    expect(row.children.at(-1)).toBe(pillOf(row));
    expect(td.children.at(-1)).toBe(pillOf(td));
    for (const host of [slot(1), row, td]) {
      expect(pillOf(host).dataset.count).toBe('1');
      expect(pillOf(host).getAttribute('songid')).toBeNull();
    }
    row.remove();
    tbody.children.forEach((c) => c.remove());
  });

  it('a pill it adds or updates causes no feedback loop', () => {
    slot(1).setAttribute('songid', '12');
    deliver();
    played.recordPlay('12');
    // Its own insertion is observed once and found already in line
    expect(deliver()).toBeLessThanOrEqual(1);
    played.recordPlay('12');
    expect(deliver()).toBeLessThanOrEqual(1);
    expect(pillOf(slot(1)).dataset.count).toBe('2');
    expect(slot(1).querySelectorAll('.played-pill')).toHaveLength(1);
  });

  it('removes the pill when a slot\'s songid is cleared, and moves it with a swap', () => {
    played.load({ 12: 2 });
    slot(1).setAttribute('songid', '12');
    deliver();
    expect(pillOf(slot(1)).dataset.count).toBe('2');

    // Swapped to F2, as setLabelFromSongId does
    slot(1).removeAttribute('songid');
    slot(2).setAttribute('songid', '12');
    deliver();
    expect(pillOf(slot(1))).toBeNull();
    expect(pillOf(slot(2)).dataset.count).toBe('2');

    slot(2).removeAttribute('songid');
    deliver();
    expect(pillOf(slot(2))).toBeNull();
  });

  it('re-syncs a row whose text was replaced and a cloned row added later', () => {
    played.load({ 7: 1 });
    const row = tankRow('7');
    deliver();
    expect(pillOf(row)).not.toBeNull();

    // Setting the row's text drops the pill; the observer puts it back
    row.textContent = 'We Are Family by Sister Sledge (0:07)';
    expect(pillOf(row)).toBeNull();
    deliver();
    expect(pillOf(row).dataset.count).toBe('1');

    // A clone of a row (as a new tab's list is cloned) is synced when added
    const clone = row.cloneNode(true);
    clone.children.splice(0);
    tankList.append(clone);
    deliver();
    expect(pillOf(clone).dataset.count).toBe('1');
    row.remove();
    clone.remove();
  });

  it('updates only the rows of the songs whose counts changed', () => {
    played.load({ 12: 1, 7: 1 });
    slot(1).setAttribute('songid', '12');
    slot(2).setAttribute('songid', '7');
    deliver();
    const untouched = pillOf(slot(2));

    played.recordPlay('12');
    expect(pillOf(slot(1)).dataset.count).toBe('2');
    expect(pillOf(slot(2))).toBe(untouched);

    played.clear('12');
    expect(pillOf(slot(1))).toBeNull();
    expect(pillOf(slot(2)).dataset.count).toBe('1');

    played.clearAll();
    expect(pillOf(slot(2))).toBeNull();
    slot(1).removeAttribute('songid');
    slot(2).removeAttribute('songid');
    deliver();
  });

  it('gives a search title no pill for an unplayed song, and one when it is played', () => {
    const td = searchCell('9');
    expect(pillOf(td)).toBeNull();
    played.recordPlay('9');
    expect(pillOf(td).dataset.count).toBe('1');
    tbody.children.forEach((c) => c.remove());
  });
});
