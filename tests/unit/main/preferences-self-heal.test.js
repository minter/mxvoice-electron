/**
 * Unit tests for preferences-self-heal.
 *
 * Verifies the recovery behavior added in 4.3.1 for users whose global
 * directory preferences were wiped by the pre-4.3.1 preferences-save bug.
 * Critically also verifies it is a strict no-op for normal installs.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs';

import { selfHealDirectoryPreferences } from '../../../src/main/modules/preferences-self-heal.js';

const USER_DATA = '/fake/userData';
const DEFAULT_MUSIC = path.join(USER_DATA, 'mp3');
const DEFAULT_HOTKEY = path.join(USER_DATA, 'hotkeys');
const NESTED_DATA = path.join(USER_DATA, 'data');

function makeStore(initial = {}) {
  const data = { ...initial };
  return {
    data,
    get: vi.fn((key) => data[key]),
    set: vi.fn((key, value) => { data[key] = value; }),
  };
}

function makeApp(userDataPath = USER_DATA) {
  return { getPath: vi.fn(() => userDataPath) };
}

function makeDebugLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('selfHealDirectoryPreferences', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('is a no-op when every directory preference has a valid value', () => {
    const customDb = '/custom/db';
    const customMusic = '/custom/music';
    const customHotkey = '/custom/hotkey';
    const store = makeStore({
      database_directory: customDb,
      music_directory: customMusic,
      hotkey_directory: customHotkey,
    });
    const app = makeApp();
    const debugLog = makeDebugLog();

    // Should not need fs at all — assert it isn't touched.
    const existsSpy = vi.spyOn(fs, 'existsSync');

    selfHealDirectoryPreferences({ store, app, debugLog });

    expect(store.set).not.toHaveBeenCalled();
    expect(existsSpy).not.toHaveBeenCalled();
    expect(debugLog.warn).not.toHaveBeenCalled();
    expect(store.data.database_directory).toBe(customDb);
    expect(store.data.music_directory).toBe(customMusic);
    expect(store.data.hotkey_directory).toBe(customHotkey);
  });

  it('restores database_directory to userData when a mrvoice.db exists there', () => {
    const store = makeStore({
      database_directory: '',
      music_directory: DEFAULT_MUSIC,
      hotkey_directory: DEFAULT_HOTKEY,
    });
    const app = makeApp();
    const debugLog = makeDebugLog();

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === path.join(USER_DATA, 'mrvoice.db'));

    selfHealDirectoryPreferences({ store, app, debugLog });

    expect(store.set).toHaveBeenCalledWith('database_directory', USER_DATA);
    expect(store.data.database_directory).toBe(USER_DATA);
    expect(debugLog.warn).toHaveBeenCalledWith(
      expect.stringContaining('database_directory'),
      expect.objectContaining({ discoveredExistingDb: true, recovered: USER_DATA })
    );
  });

  it('restores database_directory to userData when only mxvoice.db exists there', () => {
    const store = makeStore({ database_directory: '' });
    const app = makeApp();

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === path.join(USER_DATA, 'mxvoice.db'));

    selfHealDirectoryPreferences({ store, app });

    expect(store.set).toHaveBeenCalledWith('database_directory', USER_DATA);
  });

  it('falls back to the userData/data subdirectory when the db lives there', () => {
    const store = makeStore({ database_directory: '' });
    const app = makeApp();

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === path.join(NESTED_DATA, 'mxvoice.db'));

    selfHealDirectoryPreferences({ store, app });

    expect(store.set).toHaveBeenCalledWith('database_directory', NESTED_DATA);
  });

  it('prefers userData root over userData/data when both contain a db', () => {
    const store = makeStore({ database_directory: '' });
    const app = makeApp();

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    selfHealDirectoryPreferences({ store, app });

    expect(store.set).toHaveBeenCalledWith('database_directory', USER_DATA);
  });

  it('restores database_directory to the userData default when no db file is found anywhere', () => {
    const store = makeStore({ database_directory: '' });
    const app = makeApp();
    const debugLog = makeDebugLog();

    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    selfHealDirectoryPreferences({ store, app, debugLog });

    expect(store.set).toHaveBeenCalledWith('database_directory', USER_DATA);
    expect(debugLog.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ discoveredExistingDb: false, recovered: USER_DATA })
    );
  });

  it('restores music_directory to userData/mp3 when blank', () => {
    const store = makeStore({
      database_directory: USER_DATA,
      music_directory: '',
      hotkey_directory: DEFAULT_HOTKEY,
    });
    const app = makeApp();

    selfHealDirectoryPreferences({ store, app });

    expect(store.set).toHaveBeenCalledWith('music_directory', DEFAULT_MUSIC);
    expect(store.set).not.toHaveBeenCalledWith('database_directory', expect.anything());
    expect(store.set).not.toHaveBeenCalledWith('hotkey_directory', expect.anything());
  });

  it('restores hotkey_directory to userData/hotkeys when blank', () => {
    const store = makeStore({
      database_directory: USER_DATA,
      music_directory: DEFAULT_MUSIC,
      hotkey_directory: '',
    });
    const app = makeApp();

    selfHealDirectoryPreferences({ store, app });

    expect(store.set).toHaveBeenCalledWith('hotkey_directory', DEFAULT_HOTKEY);
  });

  it('treats whitespace-only values as blank', () => {
    const store = makeStore({
      database_directory: '   ',
      music_directory: '\t',
      hotkey_directory: '\n',
    });
    const app = makeApp();

    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    selfHealDirectoryPreferences({ store, app });

    expect(store.set).toHaveBeenCalledWith('database_directory', USER_DATA);
    expect(store.set).toHaveBeenCalledWith('music_directory', DEFAULT_MUSIC);
    expect(store.set).toHaveBeenCalledWith('hotkey_directory', DEFAULT_HOTKEY);
  });

  it('treats non-string values (undefined / null / number) as blank', () => {
    const store = makeStore({
      database_directory: undefined,
      music_directory: null,
      hotkey_directory: 0,
    });
    const app = makeApp();

    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    selfHealDirectoryPreferences({ store, app });

    expect(store.set).toHaveBeenCalledWith('database_directory', USER_DATA);
    expect(store.set).toHaveBeenCalledWith('music_directory', DEFAULT_MUSIC);
    expect(store.set).toHaveBeenCalledWith('hotkey_directory', DEFAULT_HOTKEY);
  });

  it('survives fs.existsSync throwing and falls back to the default', () => {
    const store = makeStore({ database_directory: '' });
    const app = makeApp();
    const debugLog = makeDebugLog();

    vi.spyOn(fs, 'existsSync').mockImplementation(() => {
      throw new Error('boom');
    });

    selfHealDirectoryPreferences({ store, app, debugLog });

    expect(store.set).toHaveBeenCalledWith('database_directory', USER_DATA);
    expect(debugLog.error).not.toHaveBeenCalled();
  });

  it('logs and exits early when app.getPath throws', () => {
    const store = makeStore({ database_directory: '' });
    const app = { getPath: vi.fn(() => { throw new Error('no userData'); }) };
    const debugLog = makeDebugLog();

    selfHealDirectoryPreferences({ store, app, debugLog });

    expect(store.set).not.toHaveBeenCalled();
    expect(debugLog.error).toHaveBeenCalledWith(
      expect.stringContaining('userData'),
      expect.objectContaining({ error: 'no userData' })
    );
  });

  it('logs and continues when store.set throws on the database write', () => {
    const store = makeStore({ database_directory: '' });
    const debugLog = makeDebugLog();
    store.set.mockImplementation((key) => {
      if (key === 'database_directory') throw new Error('disk full');
    });

    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    selfHealDirectoryPreferences({ store, app: makeApp(), debugLog });

    expect(debugLog.error).toHaveBeenCalledWith(
      expect.stringContaining('unexpected failure'),
      expect.objectContaining({ error: 'disk full' })
    );
  });

  it('does nothing when store or app is missing (defensive)', () => {
    expect(() => selfHealDirectoryPreferences({})).not.toThrow();
    expect(() => selfHealDirectoryPreferences({ store: makeStore() })).not.toThrow();
    expect(() => selfHealDirectoryPreferences({ app: makeApp() })).not.toThrow();
  });
});
