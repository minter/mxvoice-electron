import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = { getSongById: vi.fn(), deleteSong: vi.fn() }; const file = { delete: vi.fn() }; const pathApi = { join: vi.fn() }; const store = { get: vi.fn() }; const analytics = { trackEvent: vi.fn() }; const confirm = vi.fn();
vi.mock('../../../src/renderer/modules/adapters/secure-adapter.js', () => ({ secureDatabase: db, secureFileSystem: file, securePath: pathApi, secureStore: store, secureAnalytics: analytics }));
vi.mock('../../../src/renderer/modules/utils/index.js', () => ({ customConfirm: confirm }));
globalThis.window = { debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } };
const selected = { getAttribute: () => '42', remove: vi.fn(), removeAttribute: vi.fn() };
globalThis.document = { getElementById: () => selected, querySelectorAll: () => [] };
const removal = await import('../../../src/renderer/modules/song-management/song-removal.js');
describe('song removal contracts', () => {
  beforeEach(() => { vi.clearAllMocks(); db.getSongById.mockResolvedValue({ success: true, data: [{ title: 'Song', filename: 'song.mp3' }] }); });
  it('does not touch storage when deletion is cancelled', async () => { confirm.mockResolvedValue(false); await expect(removal.deleteSong()).resolves.toEqual({ success: false, error: 'User cancelled' }); expect(db.deleteSong).not.toHaveBeenCalled(); });
  it('stops cleanup when database deletion fails', async () => { confirm.mockResolvedValue(true); db.deleteSong.mockResolvedValue({ success: false, error: 'locked' }); await expect(removal.deleteSong()).resolves.toEqual({ success: false, error: 'locked' }); expect(file.delete).not.toHaveBeenCalled(); });
  it('deletes database/file and synchronizes state modules', async () => {
    confirm.mockResolvedValue(true); db.deleteSong.mockResolvedValue({ success: true }); store.get.mockResolvedValue({ success: true, value: '/music' }); pathApi.join.mockResolvedValue({ success: true, data: '/music/song.mp3' }); file.delete.mockResolvedValue({ success: true });
    const modules = { holdingTank: { clearSongFromHoldingTankState: vi.fn() }, hotkeys: { clearSong: vi.fn() }, profileState: { saveProfileState: vi.fn() } }; removal.configureSongRemovalDependencies({ moduleRegistry: modules });
    await expect(removal.deleteSong()).resolves.toMatchObject({ success: true, songId: '42' }); expect(file.delete).toHaveBeenCalledWith('/music/song.mp3'); expect(modules.hotkeys.clearSong).toHaveBeenCalledWith('42'); expect(analytics.trackEvent).toHaveBeenCalledWith('song_deleted');
  });
});
