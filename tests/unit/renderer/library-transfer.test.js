import { beforeEach, describe, expect, it, vi } from 'vitest';

const showModal = vi.fn();
const hideModal = vi.fn();
const logInfo = vi.fn();
const logError = vi.fn();

vi.mock('../../../src/renderer/modules/ui/bootstrap-adapter.js', () => ({ showModal, hideModal }));
vi.mock('../../../src/renderer/modules/debug-log/index.js', () => ({ info: logInfo, error: logError }));

const elements = new Map();
function element() {
  const classes = new Set();
  return {
    textContent: '', style: {},
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name)
    },
    addEventListener: vi.fn()
  };
}

globalThis.document = {
  getElementById: (id) => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  }
};

const libraryTransfer = await import('../../../src/renderer/modules/library-transfer/index.js');

function createAPI(result) {
  const cleanup = vi.fn();
  const library = {
    onExportProgress: vi.fn((listener) => {
      listener({ percent: 25, message: 'Copying music' });
      return cleanup;
    }),
    exportLibrary: vi.fn().mockResolvedValue(result)
  };
  return { api: { library }, library, cleanup };
}

describe('library transfer renderer export workflow', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('shows progress, formats completion size, and removes the listener', async () => {
    const { api, cleanup } = createAPI({ success: true, archiveSize: 1536 });
    libraryTransfer.initializeLibraryTransfer({ electronAPI: api });
    await libraryTransfer.startExport();

    expect(showModal).toHaveBeenCalledWith('#libraryTransferModal');
    expect(elements.get('library-transfer-message').textContent).toBe('Export complete! (1.5 KB)');
    expect(elements.get('library-transfer-percent').textContent).toBe('100%');
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('hides the progress modal when file selection is canceled', async () => {
    const { api, cleanup } = createAPI({ canceled: true });
    libraryTransfer.initializeLibraryTransfer({ electronAPI: api });
    await libraryTransfer.startExport();

    expect(hideModal).toHaveBeenCalledWith('#libraryTransferModal');
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('presents wrapped failures and cleans up progress listeners', async () => {
    const { api, library, cleanup } = createAPI(null);
    library.exportLibrary.mockRejectedValue(new Error('archive write failed'));
    libraryTransfer.initializeLibraryTransfer({ electronAPI: api });
    await libraryTransfer.startExport();

    expect(elements.get('library-transfer-message').textContent).toBe('Export failed: archive write failed');
    expect(elements.get('library-transfer-bar').classList.contains('bg-danger')).toBe(true);
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('does not start an export without the preload library API', async () => {
    libraryTransfer.initializeLibraryTransfer({ electronAPI: {} });
    await libraryTransfer.startExport();
    expect(showModal).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(
      'Electron API not available for library transfer', expect.any(Object)
    );
  });
});
