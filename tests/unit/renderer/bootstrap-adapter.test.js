import { describe, expect, it, vi } from 'vitest';

globalThis.window = globalThis.window || {};

function fakeModal(attributes = {}) {
  return { hasAttribute: (name) => Object.hasOwn(attributes, name), hide: vi.fn() };
}

const { hideAllModals } = await import('../../../src/renderer/modules/ui/bootstrap-adapter.js');

describe('hideAllModals', () => {
  it('hideAllModals skips data-mxv-prompt dialogs', () => {
    const plain = fakeModal();
    const prompt = fakeModal({ 'data-mxv-prompt': 'true' });
    globalThis.document = { querySelectorAll: vi.fn(() => [plain, prompt]) };
    window.bootstrap = { Modal: { getOrCreateInstance: (element) => element } };

    hideAllModals();

    expect(document.querySelectorAll).toHaveBeenCalledWith('.modal.show');
    expect(plain.hide).toHaveBeenCalledOnce();
    expect(prompt.hide).not.toHaveBeenCalled();
  });
});
