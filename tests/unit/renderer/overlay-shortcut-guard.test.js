import { describe, expect, it, vi } from 'vitest';

const {
  isFunctionKeyCombo,
  isOverlayOpen,
  shouldStopShortcut,
  installOverlayShortcutGuard
} = await import('../../../src/renderer/modules/keyboard-manager/overlay-shortcut-guard.js');

// A document with an optional shown dialog, tour, and the two menus' display styles
function fakeDoc({ modal = false, tabMenu, songMenu, tour = false } = {}) {
  const menus = {
    'mxv-tab-actions-menu': tabMenu === undefined ? null : { style: { display: tabMenu } },
    'mxv-context-menu': songMenu === undefined ? null : { style: { display: songMenu } }
  };
  return {
    querySelector: vi.fn((selector) => (modal && selector.includes('.modal') ? {} : null)),
    getElementById: (id) => menus[id] ?? null,
    body: { classList: { contains: (name) => tour && name === 'driver-active' } }
  };
}

describe('isFunctionKeyCombo', () => {
  it('is F1 through F12, with or without modifiers', () => {
    for (const combo of ['f1', 'f9', 'f10', 'f12', 'shift+f3', 'ctrl+shift+f11']) {
      expect(isFunctionKeyCombo(combo)).toBe(true);
    }
  });

  it('is not other keys', () => {
    for (const combo of ['return', 'space', 'esc', 'shift+esc', 'f', 'f13', 'f0', 'command+f', undefined]) {
      expect(isFunctionKeyCombo(combo)).toBe(false);
    }
  });
});

describe('isOverlayOpen', () => {
  it('is false with nothing open, or with hidden menus', () => {
    expect(isOverlayOpen(fakeDoc())).toBe(false);
    expect(isOverlayOpen(fakeDoc({ tabMenu: 'none', songMenu: 'none' }))).toBe(false);
    expect(isOverlayOpen(fakeDoc({ tabMenu: '', songMenu: '' }))).toBe(false);
  });

  it('is true while a dialog is shown, or still closing', () => {
    const doc = fakeDoc({ modal: true });
    expect(isOverlayOpen(doc)).toBe(true);
    expect(doc.querySelector).toHaveBeenCalledWith('.modal.show, .modal[aria-modal="true"]');
  });

  it('is true while the tab actions menu shows', () => {
    expect(isOverlayOpen(fakeDoc({ tabMenu: 'block', songMenu: 'none' }))).toBe(true);
  });

  it('is false while only the song menu shows: it takes no keys, so Esc must still stop playback', () => {
    expect(isOverlayOpen(fakeDoc({ tabMenu: 'none', songMenu: 'block' }))).toBe(false);
  });

  it("is true during a What's New tour", () => {
    expect(isOverlayOpen(fakeDoc({ tour: true }))).toBe(true);
  });

  it('is false without a document', () => {
    expect(isOverlayOpen(null)).toBe(false);
  });
});

describe('shouldStopShortcut', () => {
  it('ignores app shortcuts while a dialog or menu is open', () => {
    const baseStop = vi.fn(() => false);
    for (const combo of ['return', 'space', 'esc', 'shift+esc', 'down', 'tab']) {
      expect(shouldStopShortcut({ combo, doc: fakeDoc({ modal: true }), baseStop })).toBe(true);
      expect(shouldStopShortcut({ combo, doc: fakeDoc({ tabMenu: 'block' }), baseStop })).toBe(true);
      expect(shouldStopShortcut({ combo, doc: fakeDoc({ tour: true }), baseStop })).toBe(true);
    }
    expect(baseStop).not.toHaveBeenCalled();
  });

  it('leaves app shortcuts on the base rule while the song menu shows', () => {
    expect(shouldStopShortcut({ combo: 'esc', doc: fakeDoc({ songMenu: 'block' }), baseStop: () => false })).toBe(false);
  });

  it('keeps hotkeys F1-F12 on the base rule under a tour', () => {
    expect(shouldStopShortcut({ combo: 'f3', doc: fakeDoc({ tour: true }), baseStop: () => false })).toBe(false);
  });

  it('keeps hotkeys F1-F12 on the base rule under a dialog', () => {
    expect(shouldStopShortcut({ combo: 'f1', doc: fakeDoc({ modal: true }), baseStop: () => false })).toBe(false);
    // In a text field the base rule still stops it
    expect(shouldStopShortcut({ combo: 'f2', doc: fakeDoc({ modal: true }), baseStop: () => true })).toBe(true);
  });

  it('uses the base rule with nothing open', () => {
    expect(shouldStopShortcut({ combo: 'return', doc: fakeDoc(), baseStop: () => false })).toBe(false);
    expect(shouldStopShortcut({ combo: 'return', doc: fakeDoc(), baseStop: () => true })).toBe(true);
  });
});

describe('installOverlayShortcutGuard', () => {
  function FakeMousetrap() {}
  const makeCtor = () => {
    const ctor = function () {};
    ctor.prototype.stopCallback = vi.fn(function () { return this.inField === true; });
    return ctor;
  };

  it('wraps stopCallback once, calling the base with the instance', () => {
    const Ctor = makeCtor();
    const base = Ctor.prototype.stopCallback;
    let doc = fakeDoc();
    const docRef = { get current() { return doc; } };
    expect(installOverlayShortcutGuard(Ctor, () => docRef.current)).toBe(true);
    expect(installOverlayShortcutGuard(Ctor, () => docRef.current)).toBe(true);
    const instance = new Ctor();
    const event = {};
    const element = {};

    expect(instance.stopCallback(event, element, 'return', undefined)).toBe(false);
    expect(base).toHaveBeenCalledTimes(1);
    expect(base.mock.contexts[0]).toBe(instance);
    expect(base).toHaveBeenCalledWith(event, element, 'return', undefined);

    doc = fakeDoc({ modal: true });
    expect(instance.stopCallback(event, element, 'return')).toBe(true);
    expect(instance.stopCallback(event, element, 'f5')).toBe(false);
    // Installed twice, but the base runs once per check
    expect(base).toHaveBeenCalledTimes(2);
  });

  it('does nothing without a Mousetrap prototype', () => {
    expect(installOverlayShortcutGuard(undefined)).toBe(false);
    expect(installOverlayShortcutGuard(FakeMousetrap)).toBe(false);
    expect(installOverlayShortcutGuard(Object.assign(() => {}, { prototype: undefined }))).toBe(false);
  });
});
