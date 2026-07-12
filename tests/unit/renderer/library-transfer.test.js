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
    children: [],
    addEventListener: vi.fn(),
    appendChild(child) { this.children.push(child); return child; }
  };
}

globalThis.document = {
  getElementById: (id) => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  },
  createElement: () => element()
};

globalThis.window = {
  secureElectronAPI: { analytics: { trackEvent: vi.fn() } },
  location: { reload: vi.fn() }
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

function createImportAPI(result) {
  const cleanup = vi.fn();
  let progressListener;
  const library = {
    onImportProgress: vi.fn((listener) => { progressListener = listener; return cleanup; }),
    importLibrary: vi.fn().mockImplementation(async () => {
      progressListener?.({ percent: 50, message: 'Validating archive' });
      return result;
    }),
    confirmImport: vi.fn()
  };
  return { api: { library, app: { restart: vi.fn() } }, library, cleanup };
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

describe('library transfer renderer import workflow', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('validates the archive, renders safe manifest details, and opens confirmation', async () => {
    const manifest = {
      createdAt: '2026-01-02T03:04:05.000Z', appVersion: '<script>bad</script>',
      platform: 'darwin', archiveSize: 2048,
      contents: { hasDatabase: true, mp3Count: 12, profileCount: 2, hotkeyCount: 4 }
    };
    const { api, cleanup } = createImportAPI({
      success: true, archivePath: '/tmp/library.mxvlib', manifest
    });
    libraryTransfer.initializeLibraryTransfer({ electronAPI: api });
    await libraryTransfer.startImport();

    expect(cleanup).toHaveBeenCalledOnce();
    expect(hideModal).toHaveBeenCalledWith('#libraryTransferModal');
    expect(showModal).toHaveBeenCalledWith('#libraryImportConfirmModal');
    const table = elements.get('library-import-manifest-info').children[0];
    expect(table.children[0].children[1].children[1].textContent).toBe('<script>bad</script>');
  });

  it('shows validation failures and removes the progress listener', async () => {
    const { api, cleanup } = createImportAPI({ success: false, error: 'Invalid manifest' });
    libraryTransfer.initializeLibraryTransfer({ electronAPI: api });
    await libraryTransfer.startImport();

    expect(cleanup).toHaveBeenCalledOnce();
    expect(elements.get('library-transfer-message').textContent).toBe('Invalid manifest');
    expect(elements.get('library-transfer-bar').classList.contains('bg-danger')).toBe(true);
  });

  it('cleans up and hides validation progress when selection is canceled', async () => {
    const { api, cleanup } = createImportAPI({ canceled: true });
    libraryTransfer.initializeLibraryTransfer({ electronAPI: api });
    await libraryTransfer.startImport();

    expect(cleanup).toHaveBeenCalledOnce();
    expect(hideModal).toHaveBeenCalledWith('#libraryTransferModal');
    expect(showModal).not.toHaveBeenCalledWith('#libraryImportConfirmModal');
  });
});
