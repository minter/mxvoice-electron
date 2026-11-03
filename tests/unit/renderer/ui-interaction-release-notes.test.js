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
