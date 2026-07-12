import { beforeEach, describe, expect, it, vi } from 'vitest';
const scan = vi.fn(); const showMulti = vi.fn(); const showModal = vi.fn();
vi.mock('../../../src/renderer/modules/adapters/secure-adapter.js', () => ({ secureFileSystem: { scanAudioDirectory: scan }, secureDatabase: {}, securePath: {}, secureStore: {} }));
vi.mock('../../../src/renderer/modules/bulk-operations/multi-song-import.js', () => ({ showMultiSongImport: showMulti, MULTI_SONG_THRESHOLD: 20 }));
vi.mock('../../../src/renderer/modules/categories/category-data.js', () => ({ populateCategorySelect: vi.fn(), findUniqueCategoryCode: vi.fn(), refreshCategories: vi.fn(), getCategoryDescription: vi.fn() }));
vi.mock('../../../src/renderer/modules/ui/bootstrap-helpers.js', () => ({ safeShowModal: showModal, safeHideModal: vi.fn() }));
vi.mock('../../../src/renderer/modules/drag-drop/drag-drop-functions.js', () => ({ songDrag: vi.fn() }));
globalThis.alert = vi.fn(); globalThis.window = { debugLog: { info: vi.fn() }, secureElectronAPI: { audio: { getMetadata: vi.fn() } } }; globalThis.document = { getElementById: () => ({ value: '' }) };
const bulk = await import('../../../src/renderer/modules/bulk-operations/bulk-operations.js');
describe('bulk import routing', () => {
  beforeEach(() => vi.clearAllMocks());
  it('reports empty scans', async () => { scan.mockResolvedValue({ success: true, data: [] }); await bulk.showBulkAddModal('/empty'); expect(alert).toHaveBeenCalled(); });
  it('routes one song to normal add and small batches to multi-song import', async () => {
    const startAddNewSong = vi.fn(); bulk.configureBulkOperationsDependencies({ moduleRegistry: { songManagement: { startAddNewSong } } });
    scan.mockResolvedValueOnce({ success: true, data: ['/one.mp3'] }); await bulk.showBulkAddModal('/one'); expect(startAddNewSong).toHaveBeenCalledWith('/one.mp3', null);
    scan.mockResolvedValueOnce({ success: true, data: ['/1.mp3', '/2.mp3'] }); await bulk.showBulkAddModal('/two'); expect(showMulti).toHaveBeenCalledWith(['/1.mp3', '/2.mp3']);
  });
  it('uses the bulk modal above the threshold', async () => { const files = Array.from({ length: 21 }, (_, i) => `/${i}.mp3`); scan.mockResolvedValue({ success: true, data: files }); await bulk.showBulkAddModal('/many'); expect(showModal).toHaveBeenCalledWith('#bulkAddModal', expect.any(Object)); });
});
