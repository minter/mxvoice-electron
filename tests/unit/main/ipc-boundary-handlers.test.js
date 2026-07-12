import { beforeEach, describe, expect, it, vi } from 'vitest';
import ipcChannels from '../../../src/shared/ipc-channels.cjs';
const { IPC } = ipcChannels;

const handlers = {};
const ipcMain = { handle: (channel, handler) => { handlers[channel] = handler; } };
const dialog = { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() };
const app = { getPath: vi.fn(() => '/documents') };
const transfer = { exportLibrary: vi.fn(), validateArchive: vi.fn(), importLibrary: vi.fn() };

vi.mock('electron', () => ({ default: { ipcMain, dialog, app }, ipcMain, dialog, app }));
vi.mock('../../../src/main/modules/library-transfer-manager.js', () => transfer);

const pathHandlers = await import('../../../src/main/modules/ipc/path-os-handlers.js');
const utilityHandlers = await import('../../../src/main/modules/ipc/utility-handlers.js');
const libraryHandlers = await import('../../../src/main/modules/ipc/library-handlers.js');
const debugLog = { error: vi.fn() };
const window = { isDestroyed: vi.fn(() => false), webContents: { send: vi.fn() } };

function invoke(channel, ...args) { return handlers[channel]({}, ...args); }

beforeEach(() => {
  vi.clearAllMocks();
  pathHandlers.register({ debugLog });
  utilityHandlers.register({ debugLog });
  libraryHandlers.register({ debugLog, getMainWindow: () => window });
});

describe('path and utility IPC boundaries', () => {
  it('wraps normal path operations and rejects invalid required paths', async () => {
    await expect(invoke(IPC.PATH_OS.PATH_JOIN, '/tmp', 'song.mp3')).resolves.toMatchObject({ success: true, data: '/tmp/song.mp3' });
    await expect(invoke(IPC.PATH_OS.PATH_PARSE, '/tmp/song.mp3')).resolves.toMatchObject({ success: true, data: { ext: '.mp3' } });
    await expect(invoke(IPC.PATH_OS.PATH_DIRNAME, null)).resolves.toEqual({ success: false, error: 'Invalid file path' });
    await expect(invoke(IPC.PATH_OS.PATH_NORMALIZE, 42)).resolves.toEqual({ success: false, error: 'Invalid file path' });
  });

  it('formats durations, validates audio extensions, and sanitizes filenames', async () => {
    await expect(invoke(IPC.UTILITY.FORMAT_DURATION, 125.9)).resolves.toEqual({ success: true, data: '2:05' });
    await expect(invoke(IPC.UTILITY.VALIDATE_AUDIO_FILE, '/tmp/SHOW.MP3')).resolves.toEqual({ success: true, data: true });
    await expect(invoke(IPC.UTILITY.VALIDATE_AUDIO_FILE, null)).resolves.toEqual({ success: true, data: false });
    await expect(invoke(IPC.UTILITY.SANITIZE_FILENAME, 'bad:name?.mp3')).resolves.toEqual({ success: true, data: 'bad_name_.mp3' });
  });
});

describe('library transfer IPC boundaries', () => {
  it('handles export cancellation and forwards progress for successful exports', async () => {
    dialog.showSaveDialog.mockResolvedValueOnce({ canceled: true });
    await expect(invoke(IPC.LIBRARY.EXPORT)).resolves.toEqual({ success: false, canceled: true });

    dialog.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: '/tmp/out.mxvlib' });
    transfer.exportLibrary.mockImplementation(async (_path, progress) => {
      progress({ percent: 25 }); return { success: true };
    });
    await expect(invoke(IPC.LIBRARY.EXPORT)).resolves.toEqual({ success: true });
    expect(window.webContents.send).toHaveBeenCalledWith('library:export-progress', { percent: 25 });
  });

  it('validates selected imports and delegates confirmed imports', async () => {
    dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/in.mxvlib'] });
    transfer.validateArchive.mockResolvedValue({ success: true, manifest: { version: 1 } });
    await expect(invoke(IPC.LIBRARY.IMPORT)).resolves.toMatchObject({
      success: true, archivePath: '/tmp/in.mxvlib', manifest: { version: 1 }
    });
    expect(window.webContents.send).toHaveBeenCalledWith('library:import-progress', expect.any(Object));

    transfer.importLibrary.mockResolvedValue({ success: true, songCount: 3 });
    await expect(invoke(IPC.LIBRARY.IMPORT_CONFIRM, '/tmp/in.mxvlib')).resolves.toMatchObject({ success: true, songCount: 3 });
  });

  it('wraps transfer exceptions', async () => {
    dialog.showSaveDialog.mockRejectedValue(new Error('dialog unavailable'));
    await expect(invoke(IPC.LIBRARY.EXPORT)).resolves.toEqual({ success: false, error: 'dialog unavailable' });
  });
});
