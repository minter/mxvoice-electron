import { describe, expect, it, vi } from 'vitest';

globalThis.window = globalThis.window || {};
window.debugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const {
  tabLabel,
  tabActionItems,
  clearTabConfirmArgs,
  confirmClearTab,
  runTabAction,
  renderTabActionItems,
  installTabActionsMenus
} = await import('../../../src/renderer/modules/ui/tab-actions-menu.js');

function link(text, href) {
  return { textContent: text, getAttribute: (name) => (name === 'href' ? href : null) };
}

// No DOM library: elements that record textContent and refuse innerHTML
function fakeDoc() {
  const make = (tag) => {
    const el = {
      tag,
      children: [],
      attrs: {},
      className: '',
      textContent: '',
      type: '',
      append: (...kids) => { el.children.push(...kids); },
      replaceChildren: (...kids) => { el.children = [...kids]; },
      setAttribute: (name, value) => { el.attrs[name] = String(value); },
      set innerHTML(_) { throw new Error('innerHTML must not be used'); }
    };
    return el;
  };
  return { createElement: make };
}

describe('tabLabel', () => {
  it('is the tab name when it has one', () => {
    expect(tabLabel(link('Intros', '#hotkeys_list_3'))).toBe('Intros');
  });

  it('trims the name', () => {
    expect(tabLabel(link('  Walk-ons ', '#holding_tank_2'))).toBe('Walk-ons');
  });

  it('is "Tab N" when the tab has no name', () => {
    expect(tabLabel(link('', '#hotkeys_list_4'))).toBe('Tab 4');
    expect(tabLabel(link('   ', '#holding_tank_5'))).toBe('Tab 5');
  });

  it('is "Tab" with no tab at all', () => {
    expect(tabLabel(null)).toBe('Tab');
  });
});

describe('tabActionItems', () => {
  it('labels Rename and Clear for the tab', () => {
    expect(tabActionItems('Intros')).toEqual([
      { action: 'rename', icon: 'fa-pen', text: 'Rename "Intros"…' },
      { action: 'clear', icon: 'fa-eraser', text: 'Clear "Intros"…' }
    ]);
  });
});

describe('renderTabActionItems', () => {
  it('builds one button per action with textContent only', () => {
    const doc = fakeDoc();
    const menu = doc.createElement('div');
    menu.children.push('stale');
    renderTabActionItems(menu, '<b>Tab</b>', doc);

    expect(menu.children).toHaveLength(2);
    const [rename, clear] = menu.children;
    expect(rename.tag).toBe('button');
    expect(rename.type).toBe('button');
    expect(rename.className).toBe('mxv-context-item tab-actions-menu-item');
    expect(rename.attrs).toMatchObject({ role: 'menuitem', 'data-action': 'rename' });
    expect(rename.children[0].className).toBe('fas fa-pen fa-fw');
    expect(rename.children[1].textContent).toBe('Rename "<b>Tab</b>"…');
    expect(clear.attrs['data-action']).toBe('clear');
    expect(clear.children[0].className).toBe('fas fa-eraser fa-fw');
    expect(clear.children[1].textContent).toBe('Clear "<b>Tab</b>"…');
  });
});

describe('clear confirm', () => {
  it('names the tab, says the library keeps the songs, and defaults to Cancel', () => {
    expect(clearTabConfirmArgs('Intros')).toEqual([
      'Removes all songs from this tab. The songs stay in your library.',
      'Clear "Intros"?',
      { confirmLabel: 'Clear', defaultAction: 'cancel' }
    ]);
  });

  it('asks about the given tab and passes on the answer', async () => {
    const confirm = vi.fn().mockResolvedValue(false);
    await expect(confirmClearTab(link('', '#holding_tank_2'), confirm)).resolves.toBe(false);
    expect(confirm).toHaveBeenCalledWith(
      'Removes all songs from this tab. The songs stay in your library.',
      'Clear "Tab 2"?',
      { confirmLabel: 'Clear', defaultAction: 'cancel' }
    );
  });
});

describe('runTabAction', () => {
  const registry = () => ({
    hotkeys: { renameHotkeyTab: vi.fn(), clearHotkeys: vi.fn() },
    holdingTank: { renameHoldingTankTab: vi.fn(), clearHoldingTank: vi.fn() }
  });

  it('renames and clears hotkey tabs through the hotkeys module', () => {
    const r = registry();
    runTabAction('hotkey_tabs', 'rename', r);
    expect(r.hotkeys.renameHotkeyTab).toHaveBeenCalledTimes(1);
    runTabAction('hotkey_tabs', 'clear', r);
    expect(r.hotkeys.clearHotkeys).toHaveBeenCalledTimes(1);
    expect(r.holdingTank.renameHoldingTankTab).not.toHaveBeenCalled();
    expect(r.holdingTank.clearHoldingTank).not.toHaveBeenCalled();
  });

  it('renames and clears holding tank tabs through the holding tank module', () => {
    const r = registry();
    runTabAction('holding_tank_tabs', 'rename', r);
    expect(r.holdingTank.renameHoldingTankTab).toHaveBeenCalledTimes(1);
    runTabAction('holding_tank_tabs', 'clear', r);
    expect(r.holdingTank.clearHoldingTank).toHaveBeenCalledTimes(1);
    expect(r.hotkeys.renameHotkeyTab).not.toHaveBeenCalled();
    expect(r.hotkeys.clearHotkeys).not.toHaveBeenCalled();
  });

  it('ignores an unknown panel or action, and a module that is not loaded', () => {
    const r = registry();
    expect(() => runTabAction('search_tabs', 'rename', r)).not.toThrow();
    expect(() => runTabAction('hotkey_tabs', 'delete', r)).not.toThrow();
    expect(() => runTabAction('hotkey_tabs', 'clear', {})).not.toThrow();
    expect(r.hotkeys.renameHotkeyTab).not.toHaveBeenCalled();
    expect(r.hotkeys.clearHotkeys).not.toHaveBeenCalled();
  });
});

// A small DOM: enough tree, events and selectors for installTabActionsMenus
function createDom() {
  const doc = { listeners: {}, activeElement: null };
  class El {
    constructor(tag) {
      this.tag = tag;
      this.children = [];
      this.parent = null;
      this.attrs = {};
      this.style = {};
      this.listeners = {};
      this.classes = new Set();
      this.id = '';
      this.textContent = '';
      this.offsetWidth = 200;
      this.offsetHeight = 60;
      this.rect = { right: 0, bottom: 0 };
    }
    set className(value) { this.classes = new Set(String(value).split(/\s+/).filter(Boolean)); }
    get className() { return [...this.classes].join(' '); }
    get classList() { return { contains: (c) => this.classes.has(c), add: (c) => this.classes.add(c), remove: (c) => this.classes.delete(c) }; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    getAttribute(name) { return this.attrs[name] ?? null; }
    append(...kids) { kids.forEach((kid) => { kid.parent = this; this.children.push(kid); }); }
    appendChild(kid) { this.append(kid); return kid; }
    replaceChildren(...kids) { this.children = []; this.append(...kids); }
    addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
    matches(selector) {
      if (selector === 'button') return this.tag === 'button';
      if (selector === '[data-action]') return 'data-action' in this.attrs;
      if (selector.startsWith('.')) return this.classes.has(selector.slice(1));
      return false;
    }
    closest(selector) {
      for (let el = this; el; el = el.parent) if (el.matches(selector)) return el;
      return null;
    }
    contains(other) {
      for (let el = other; el; el = el.parent) if (el === this) return true;
      return false;
    }
    *descendants() { for (const kid of this.children) { yield kid; yield* kid.descendants(); } }
    querySelector(selector) {
      for (const el of this.descendants()) if (el.matches(selector)) return el;
      return null;
    }
    focus() { doc.activeElement = this; }
    getBoundingClientRect() { return this.rect; }
  }
  const body = new El('body');
  Object.assign(doc, {
    body,
    createElement: (tag) => new El(tag),
    getElementById: (id) => [...body.descendants()].find((el) => el.id === id) ?? null,
    querySelector: (selector) => {
      const strip = doc.getElementById(selector.match(/^#(\w+) \.nav-link\.active$/)?.[1]);
      return strip ? [...strip.descendants()].find((el) => el.classes.has('nav-link') && el.classes.has('active')) ?? null : null;
    },
    addEventListener: (type, handler) => { (doc.listeners[type] ||= []).push(handler); }
  });
  const win = { innerWidth: 1200, innerHeight: 800, listeners: {}, addEventListener: (type, handler) => { (win.listeners[type] ||= []).push(handler); } };

  // Bubble from target to the document; resolves once async handlers finish
  const dispatch = async (target, type, props = {}) => {
    const event = {
      type, target, defaultPrevented: false, stopped: false, ...props,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.stopped = true; }
    };
    const pending = [];
    for (let el = target; el && !event.stopped; el = el.parent) {
      (el.listeners[type] || []).forEach((handler) => pending.push(handler(event)));
    }
    if (!event.stopped) (doc.listeners[type] || []).forEach((handler) => pending.push(handler(event)));
    await Promise.all(pending);
    return event;
  };
  const fire = (type, props = {}) => Promise.all((win.listeners[type] || []).map((handler) => handler({ type, ...props })));

  const strip = (id, names, prefix) => {
    const ul = new El('ul');
    ul.id = id;
    const links = names.map((name, index) => {
      const li = new El('li');
      const a = new El('a');
      a.className = index === 0 ? 'nav-link active' : 'nav-link';
      a.setAttribute('href', `#${prefix}${index + 1}`);
      a.textContent = name;
      li.append(a);
      ul.append(li);
      return a;
    });
    const li = new El('li');
    const button = new El('button');
    button.className = 'tab-actions-btn';
    const glyph = new El('svg');
    button.append(glyph);
    li.append(button);
    ul.append(li);
    body.append(ul);
    return { ul, links, button, glyph };
  };
  const hotkeys = strip('hotkey_tabs', ['1', 'Intros', '3'], 'hotkeys_list_');
  const holding = strip('holding_tank_tabs', ['1', '2', 'Walk-ons'], 'holding_tank_');
  const outside = new El('div');
  body.append(outside);

  // As Bootstrap's Tab.show does for a selector like #x .nav-link[href="#y"]
  const select = (selector) => {
    const [, id, href] = selector.match(/^#(\w+) \.nav-link\[href="([^"]+)"\]$/);
    const links = [...doc.getElementById(id).descendants()].filter((el) => el.classes.has('nav-link'));
    links.forEach((el) => el.classes.delete('active'));
    links.find((el) => el.getAttribute('href') === href).classes.add('active');
  };

  return { doc, win, dispatch, fire, hotkeys, holding, outside, select };
}

describe('installTabActionsMenus', () => {
  const setup = () => {
    const dom = createDom();
    const registry = {
      hotkeys: { renameHotkeyTab: vi.fn(), clearHotkeys: vi.fn() },
      holdingTank: { renameHoldingTankTab: vi.fn(), clearHoldingTank: vi.fn() }
    };
    const showTab = vi.fn(async (selector) => dom.select(selector));
    const debugLog = { error: vi.fn(), debug: vi.fn() };
    const handlers = installTabActionsMenus({ moduleRegistry: registry, showTab, debugLog, doc: dom.doc, win: dom.win });
    const menu = dom.doc.getElementById('mxv-tab-actions-menu');
    const item = (action) => menu.children.find((el) => el.getAttribute('data-action') === action);
    const labels = () => menu.children.map((el) => el.children[1].textContent);
    return { ...dom, registry, showTab, debugLog, handlers, menu, item, labels };
  };

  it('adds one hidden menu, reused on a second install, and reports its listeners', () => {
    const t = setup();
    expect(t.menu.style.display).toBe('none');
    expect(t.menu.className).toBe('mxv-context-menu tab-actions-menu');
    expect(t.menu.getAttribute('role')).toBe('menu');
    expect(t.handlers.map((h) => h.name)).toEqual(expect.arrayContaining([
      'tabActionsMenuClick', 'tabActionsButton:hotkey_tabs', 'tabActionsContextMenu:holding_tank_tabs',
      'tabActionsDocumentClick', 'tabActionsKeydown', 'tabActionsBlur', 'tabActionsResize'
    ]));
    installTabActionsMenus({ moduleRegistry: {}, showTab: t.showTab, debugLog: t.debugLog, doc: t.doc, win: t.win });
    expect(t.doc.body.children.filter((el) => el.id === 'mxv-tab-actions-menu')).toHaveLength(1);
  });

  it('⋯ opens the menu for the selected tab under the button, and toggles it shut', async () => {
    const t = setup();
    t.hotkeys.links[0].classes.delete('active');
    t.hotkeys.links[1].classes.add('active');
    t.hotkeys.button.rect = { right: 900, bottom: 100 };

    // A click on the icon inside the button
    const event = await t.dispatch(t.hotkeys.glyph, 'click');
    expect(event.defaultPrevented).toBe(true);
    expect(t.menu.style.display).toBe('block');
    expect(t.labels()).toEqual(['Rename "Intros"…', 'Clear "Intros"…']);
    expect(t.menu.style.left).toBe('700px');
    expect(t.menu.style.top).toBe('100px');
    expect(t.hotkeys.button.getAttribute('aria-expanded')).toBe('true');
    expect(t.doc.activeElement).toBe(t.item('rename'));

    await t.dispatch(t.hotkeys.button, 'click');
    expect(t.menu.style.display).toBe('none');
    expect(t.hotkeys.button.getAttribute('aria-expanded')).toBe('false');
  });

  it('Rename and Clear call that panel’s functions and close the menu', async () => {
    const t = setup();
    await t.dispatch(t.hotkeys.button, 'click');
    await t.dispatch(t.item('rename').children[1], 'click');
    expect(t.registry.hotkeys.renameHotkeyTab).toHaveBeenCalledTimes(1);
    expect(t.menu.style.display).toBe('none');

    await t.dispatch(t.holding.button, 'click');
    await t.dispatch(t.item('clear'), 'click');
    expect(t.registry.holdingTank.clearHoldingTank).toHaveBeenCalledTimes(1);
    expect(t.registry.hotkeys.clearHotkeys).not.toHaveBeenCalled();
    expect(t.menu.style.display).toBe('none');
  });

  it('switching from one panel’s ⋯ to the other relabels for that panel', async () => {
    const t = setup();
    await t.dispatch(t.hotkeys.button, 'click');
    await t.dispatch(t.holding.button, 'click');
    expect(t.menu.style.display).toBe('block');
    expect(t.hotkeys.button.getAttribute('aria-expanded')).toBe('false');
    expect(t.holding.button.getAttribute('aria-expanded')).toBe('true');
    await t.dispatch(t.item('rename'), 'click');
    expect(t.registry.holdingTank.renameHoldingTankTab).toHaveBeenCalledTimes(1);
  });

  it('right-clicking an unselected tab selects it, then opens at the pointer for it', async () => {
    const t = setup();
    const event = await t.dispatch(t.holding.links[2], 'contextmenu', { clientX: 120, clientY: 90 });
    expect(event.defaultPrevented).toBe(true);
    expect(t.showTab).toHaveBeenCalledWith('#holding_tank_tabs .nav-link[href="#holding_tank_3"]', expect.objectContaining({ module: 'tab-actions-menu' }));
    expect(t.holding.links[2].classList.contains('active')).toBe(true);
    expect(t.menu.style.display).toBe('block');
    expect(t.labels()).toEqual(['Rename "Walk-ons"…', 'Clear "Walk-ons"…']);
    expect(t.menu.style.left).toBe('120px');
    expect(t.menu.style.top).toBe('90px');

    await t.dispatch(t.item('clear'), 'click');
    expect(t.registry.holdingTank.clearHoldingTank).toHaveBeenCalledTimes(1);
  });

  it('right-clicking the selected tab opens without switching', async () => {
    const t = setup();
    await t.dispatch(t.hotkeys.links[0], 'contextmenu', { clientX: 10, clientY: 10 });
    expect(t.showTab).not.toHaveBeenCalled();
    expect(t.labels()).toEqual(['Rename "1"…', 'Clear "1"…']);
  });

  it('right-clicking the ⋯ itself does nothing special', async () => {
    const t = setup();
    const event = await t.dispatch(t.hotkeys.button, 'contextmenu', { clientX: 10, clientY: 10 });
    expect(event.defaultPrevented).toBe(false);
    expect(t.menu.style.display).toBe('none');
  });

  it('keeps the menu inside the window', async () => {
    const t = setup();
    await t.dispatch(t.hotkeys.links[0], 'contextmenu', { clientX: 1190, clientY: 790 });
    expect(t.menu.style.left).toBe('996px');
    expect(t.menu.style.top).toBe('736px');
    t.hotkeys.button.rect = { right: 50, bottom: 20 };
    await t.dispatch(t.outside, 'click');
    await t.dispatch(t.hotkeys.button, 'click');
    expect(t.menu.style.left).toBe('4px');
  });

  it('closes on Esc (focus back on ⋯), a click or right-click elsewhere, blur and resize', async () => {
    const t = setup();
    await t.dispatch(t.hotkeys.button, 'click');
    await t.dispatch(t.outside, 'keydown', { key: 'a' });
    expect(t.menu.style.display).toBe('block');
    await t.dispatch(t.outside, 'keydown', { key: 'Escape' });
    expect(t.menu.style.display).toBe('none');
    expect(t.doc.activeElement).toBe(t.hotkeys.button);

    await t.dispatch(t.hotkeys.button, 'click');
    await t.dispatch(t.menu, 'click');
    expect(t.menu.style.display).toBe('block');
    await t.dispatch(t.outside, 'click');
    expect(t.menu.style.display).toBe('none');

    await t.dispatch(t.hotkeys.button, 'click');
    await t.dispatch(t.outside, 'contextmenu');
    expect(t.menu.style.display).toBe('none');

    await t.dispatch(t.hotkeys.button, 'click');
    await t.fire('blur');
    expect(t.menu.style.display).toBe('none');

    await t.dispatch(t.hotkeys.button, 'click');
    await t.fire('resize');
    expect(t.menu.style.display).toBe('none');
  });

  it('logs a failed action', async () => {
    const t = setup();
    t.registry.hotkeys.clearHotkeys.mockRejectedValue(new Error('boom'));
    await t.dispatch(t.hotkeys.button, 'click');
    await t.dispatch(t.item('clear'), 'click');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(t.debugLog.error).toHaveBeenCalledWith('Tab action failed', expect.objectContaining({ tabsId: 'hotkey_tabs', error: 'boom' }));
  });
});
