import { beforeEach, describe, expect, it, vi } from 'vitest';
import ipcChannels from '../../../src/shared/ipc-channels.cjs';
const { IPC } = ipcChannels;

const handlers = {}; const ipcMain = { handle: (channel, handler) => { handlers[channel] = handler; } };
const stopAll = vi.fn(); const setGlobalVolume = vi.fn(); const parseFile = vi.fn();
const sound = { play: vi.fn(), stop: vi.fn(), pause: vi.fn(), fade: vi.fn(), volume: vi.fn(), seek: vi.fn(() => 12) };
const Howl = vi.fn(function createHowl() { return sound; });
vi.mock('electron', () => ({ default: { ipcMain }, ipcMain }));
vi.mock('howler', () => ({ Howl, Howler: { stop: stopAll, volume: setGlobalVolume } }));
vi.mock('music-metadata', () => ({ parseFile }));
const { register } = await import('../../../src/main/modules/ipc/audio-handlers.js');
const instances = new Map();
function invoke(channel, ...args) { return handlers[channel]({}, ...args); }

beforeEach(() => { vi.clearAllMocks(); instances.clear(); register({ audioInstances: instances, debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }); });

describe('audio IPC handlers', () => {
  it('creates, controls, and removes audio instances', async () => {
    const played = await invoke(IPC.AUDIO.PLAY, '/tmp/song.mp3');
    expect(played.success).toBe(true); expect(stopAll).toHaveBeenCalled(); expect(sound.play).toHaveBeenCalled();
    await invoke(IPC.AUDIO.PAUSE, played.id); expect(sound.pause).toHaveBeenCalled();
    await invoke(IPC.AUDIO.FADE, played.id, 1, 0, 500); expect(sound.fade).toHaveBeenCalledWith(1, 0, 500);
    await invoke(IPC.AUDIO.SET_VOLUME, 0.5, played.id); expect(sound.volume).toHaveBeenCalledWith(0.5);
    await expect(invoke(IPC.AUDIO.GET_POSITION, played.id)).resolves.toEqual({ success: true, position: 12 });
    await invoke(IPC.AUDIO.STOP, played.id); expect(sound.stop).toHaveBeenCalled(); expect(instances.size).toBe(0);
  });
  it('uses metadata duration and normalizes metadata fields', async () => {
    parseFile.mockResolvedValue({ common: { title: 'Song', artist: ['A', 'B'] }, format: { duration: 42.5 } });
    await expect(invoke(IPC.AUDIO.GET_DURATION, '/tmp/song.mp3')).resolves.toEqual({ success: true, duration: 42.5 });
    await expect(invoke(IPC.AUDIO.GET_METADATA, '/tmp/song.mp3')).resolves.toEqual({ success: true, data: { title: 'Song', artist: 'A, B', duration: 42.5 } });
  });
  it('rejects invalid metadata and duration paths', async () => {
    await expect(invoke(IPC.AUDIO.GET_DURATION, null)).resolves.toEqual({ success: false, error: 'Invalid file path' });
    await expect(invoke(IPC.AUDIO.GET_METADATA, 42)).resolves.toEqual({ success: false, error: 'Invalid file path' });
  });
});
