import { describe, expect, it, vi } from 'vitest';

const safeShowModal = vi.fn();
vi.mock('../../../src/renderer/modules/ui/bootstrap-helpers.js', () => ({ safeShowModal }));
let settle;
const settled = new Promise((resolve) => { settle = resolve; });
const whenStartupSettled = vi.fn(() => settled);
vi.mock('../../../src/renderer/modules/shows/startup-gate.js', () => ({ whenStartupSettled }));
vi.mock('../../../src/renderer/modules/ui/tab-actions-menu.js', () => ({ installTabActionsMenus: vi.fn() }));

const listeners = new Map();
globalThis.window = {
  debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  addEventListener: (type, fn) => listeners.set(type, fn)
};
globalThis.document = { querySelectorAll: () => [], querySelector: () => null };

const UIInteractionEvents = (await import('../../../src/renderer/modules/event-coordination/ui-interaction-events.js')).default;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('mxvoice:show-modal', () => {
  it('the release-notes modal waits for whenStartupSettled', async () => {
    new UIInteractionEvents({ debugLog: window.debugLog }).attachModalEvents();
    const show = listeners.get('mxvoice:show-modal');

    // Other modals are shown at once
    show({ detail: { selector: '#preferencesModal' } });
    await flush();
    expect(safeShowModal).toHaveBeenCalledWith('#preferencesModal', expect.any(Object));

    safeShowModal.mockClear();
    show({ detail: { selector: '#newReleaseModal' } });
    await flush();
    expect(whenStartupSettled).toHaveBeenCalled();
    expect(safeShowModal).not.toHaveBeenCalled();

    settle();
    await flush();
    expect(safeShowModal).toHaveBeenCalledWith('#newReleaseModal', expect.any(Object));
  });
});

describe('mxvoice:update-release-notes', () => {
  function setup() {
    const title = { textContent: '' };
    const innerHTMLWrites = [];
    const body = {
      textContent: '',
      set innerHTML(value) { innerHTMLWrites.push(value); },
      get innerHTML() { return ''; }
    };
    // The entity-decoding scratch element the handler makes
    const textarea = {
      set innerHTML(value) { this.value = value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'); },
      value: ''
    };
    globalThis.document = {
      querySelectorAll: () => [],
      querySelector: (selector) => (selector.endsWith('.modal-title') ? title : selector.endsWith('.modal-body') ? body : null),
      createElement: () => textarea
    };
    new UIInteractionEvents({ debugLog: window.debugLog }).attachModalEvents();
    return { title, body, innerHTMLWrites, notify: listeners.get('mxvoice:update-release-notes') };
  }
  const hostile = '&lt;img src=x onerror=&quot;globalThis.pwned=true&quot;&gt;&lt;p&gt;Fixes&lt;/p&gt;';

  it('shows the notes as plain text, never parsed, when DOMPurify is missing', async () => {
    delete window.DOMPurify;
    const { body, innerHTMLWrites, notify } = setup();

    await notify({ detail: { name: '4.5.0', notes: hostile } });

    expect(innerHTMLWrites).toEqual([]);
    expect(body.textContent).toBe('<img src=x onerror="globalThis.pwned=true"><p>Fixes</p>');
  });

  it('renders DOMPurify-sanitized notes when it is available', async () => {
    const sanitize = vi.fn(() => '<p>Fixes</p>');
    window.DOMPurify = { sanitize };
    const { body, innerHTMLWrites, notify } = setup();

    await notify({ detail: { name: '4.5.0', notes: hostile } });

    expect(sanitize).toHaveBeenCalledWith(expect.stringContaining('<img'), expect.objectContaining({ ALLOWED_ATTR: ['href', 'target', 'rel'] }));
    expect(innerHTMLWrites).toEqual(['<p>Fixes</p>']);
    expect(body.textContent).toBe('');
    delete window.DOMPurify;
  });
});
