import { beforeEach, describe, expect, it, vi } from 'vitest';

// Just enough DOM for customConfirm: the modal is built from innerHTML, and
// its buttons are looked up by class.
function fakeElement() {
  const listeners = new Map();
  const classes = new Set();
  const children = new Map();
  const element = {
    innerHTML: '',
    className: '',
    classList: { contains: (name) => classes.has(name), add: (name) => classes.add(name) },
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatch: (type, event = {}) => (listeners.get(type) || []).slice().forEach((fn) => fn(event)),
    click: () => element.dispatch('click'),
    focus: () => { globalThis.document.activeElement = element; },
    setAttribute: vi.fn(),
    remove: vi.fn(),
    querySelector: (selector) => {
      if (!children.has(selector)) children.set(selector, fakeElement());
      return children.get(selector);
    }
  };
  return element;
}

let modal;
globalThis.window = {};
globalThis.document = {
  activeElement: null,
  createElement: () => { modal = fakeElement(); return modal; },
  body: { appendChild: vi.fn() }
};
globalThis.bootstrap = {
  Modal: Object.assign(
    vi.fn(function Modal() { this.show = vi.fn(); }),
    { getOrCreateInstance: () => ({ hide: () => modal.dispatch('hidden.bs.modal') }) }
  )
};

const { customConfirm } = await import('../../../src/renderer/modules/utils/modal-utils.js');

describe('customConfirm', () => {
  beforeEach(() => { document.activeElement = null; });

  it('customConfirm with defaultAction cancel resolves false on Return', async () => {
    const answer = customConfirm('Restore?', 'Restore show?', {
      confirmLabel: 'Restore show in progress',
      cancelLabel: 'Open saved show',
      defaultAction: 'cancel'
    });
    expect(modal.innerHTML).toContain('Restore show in progress');
    expect(modal.innerHTML).toContain('Open saved show');
    modal.dispatch('shown.bs.modal');
    expect(document.activeElement).toBe(modal.querySelector('.cancel-btn'));

    // Return activates the focused button
    document.activeElement.click();
    await expect(answer).resolves.toBe(false);
  });

  it('customConfirm shows <3 Improv literally', async () => {
    const answer = customConfirm('Open <3 Improv?', '<b>Shows</b>');
    expect(modal.innerHTML).toContain('Open &lt;3 Improv?');
    expect(modal.innerHTML).toContain('&lt;b&gt;Shows&lt;/b&gt;');
    expect(modal.innerHTML).not.toContain('<3 Improv');
    modal.querySelector('.confirm-btn').click();
    await expect(answer).resolves.toBe(true);
  });

  it('keeps the existing labels and focus, and Esc or close resolves false', async () => {
    const answer = customConfirm('Are you sure?');
    expect(modal.innerHTML).toContain('>Confirm<');
    expect(modal.innerHTML).toContain('>Cancel<');
    modal.dispatch('shown.bs.modal');
    expect(document.activeElement).toBeNull();

    // Esc, a backdrop click or the close button all end in hidden
    modal.dispatch('hidden.bs.modal');
    await expect(answer).resolves.toBe(false);

    const closed = customConfirm('Again?');
    modal.querySelector('.btn-close').click();
    await expect(closed).resolves.toBe(false);
  });
});
