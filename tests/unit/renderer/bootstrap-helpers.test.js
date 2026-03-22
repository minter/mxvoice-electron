import { describe, it, expect, beforeEach, vi } from 'vitest';

// Provide window.debugLog before import (module reads it at load time)
globalThis.window = globalThis.window || {};
const mockDebugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
window.debugLog = mockDebugLog;

// We need to mock the dynamic import of bootstrap-adapter.js
// The helpers call:  import('./bootstrap-adapter.js').then(({ showModal }) => ...)
// Vitest's vi.mock works with static imports; for dynamic import we mock at module level.
vi.mock('../../../src/renderer/modules/ui/bootstrap-adapter.js', () => ({
  showModal: vi.fn(),
  hideModal: vi.fn(),
  showTab: vi.fn(),
}));

const { safeShowModal, safeHideModal, safeShowTab } = await import(
  '../../../src/renderer/modules/ui/bootstrap-helpers.js'
);

const adapter = await import('../../../src/renderer/modules/ui/bootstrap-adapter.js');

describe('bootstrap-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── safeShowModal ───────────────────────────────────────────────────

  describe('safeShowModal', () => {
    it('calls showModal from the adapter with the given selector', async () => {
      await safeShowModal('#myModal');
      expect(adapter.showModal).toHaveBeenCalledWith('#myModal');
    });

    it('does not throw when the adapter rejects', async () => {
      adapter.showModal.mockRejectedValueOnce(new Error('boom'));
      // Should resolve without throwing
      await expect(safeShowModal('#bad')).resolves.toBeUndefined();
    });

    it('logs a warning when the adapter rejects', async () => {
      adapter.showModal.mockRejectedValueOnce(new Error('boom'));
      await safeShowModal('#bad', { module: 'test' });
      expect(mockDebugLog.warn).toHaveBeenCalledWith(
        expect.stringContaining('#bad'),
        expect.objectContaining({ module: 'test', error: 'boom' }),
      );
    });
  });

  // ── safeHideModal ───────────────────────────────────────────────────

  describe('safeHideModal', () => {
    it('calls hideModal from the adapter', async () => {
      await safeHideModal('#myModal');
      expect(adapter.hideModal).toHaveBeenCalledWith('#myModal');
    });

    it('swallows errors and logs a warning', async () => {
      adapter.hideModal.mockRejectedValueOnce(new Error('fail'));
      await expect(safeHideModal('#bad')).resolves.toBeUndefined();
      expect(mockDebugLog.warn).toHaveBeenCalledWith(
        expect.stringContaining('#bad'),
        expect.objectContaining({ error: 'fail' }),
      );
    });
  });

  // ── safeShowTab ─────────────────────────────────────────────────────

  describe('safeShowTab', () => {
    it('calls showTab from the adapter', async () => {
      await safeShowTab('#tab1');
      expect(adapter.showTab).toHaveBeenCalledWith('#tab1');
    });

    it('swallows errors and logs a warning', async () => {
      adapter.showTab.mockRejectedValueOnce(new Error('tab fail'));
      await expect(safeShowTab('#badTab')).resolves.toBeUndefined();
      expect(mockDebugLog.warn).toHaveBeenCalledWith(
        expect.stringContaining('#badTab'),
        expect.objectContaining({ error: 'tab fail' }),
      );
    });
  });
});
