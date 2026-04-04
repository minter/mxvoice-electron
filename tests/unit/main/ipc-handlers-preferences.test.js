/**
 * Unit tests for profile preference IPC handlers.
 *
 * Verifies that preferences saved via profile:set-preferences are
 * correctly synced to the global store where needed (e.g., prerelease_updates
 * must reach the global store so the auto-updater can read it).
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// ── Stubs ─────────────────────────────────────────────────────────────

const handlers = {};

const fakeIpcMain = {
  handle: (channel, fn) => { handlers[channel] = fn; },
  on: () => {},
};

const fakeDialog = { showOpenDialogSync: vi.fn() };
const fakeApp = { getAppPath: vi.fn(() => '/fake'), getPath: vi.fn(() => '/fake') };

vi.mock('electron', () => ({
  default: { ipcMain: fakeIpcMain, dialog: fakeDialog, app: fakeApp },
  ipcMain: fakeIpcMain,
  dialog: fakeDialog,
  app: fakeApp,
}));

vi.mock('../../../src/main/modules/file-operations.js', () => ({
  default: { initializeFileOperations: vi.fn() },
}));

// Mock profile manager with functional load/save
const mockProfilePreferences = {};
vi.mock('../../../src/main/modules/profile-manager.js', () => ({
  default: {
    loadProfilePreferences: vi.fn(async () => ({ ...mockProfilePreferences })),
    saveProfilePreferences: vi.fn(async () => true),
  },
  loadProfilePreferences: vi.fn(async () => ({ ...mockProfilePreferences })),
  saveProfilePreferences: vi.fn(async () => true),
}));

vi.mock('../../../src/main/modules/profile-backup-manager.js', () => ({}));
vi.mock('howler', () => ({ Howl: vi.fn(), Howler: {} }));
vi.mock('music-metadata', () => ({ parseFile: vi.fn() }));

// Mock index-modular.js for getCurrentProfile
vi.mock('../../../src/main/index-modular.js', () => ({
  getCurrentProfile: vi.fn(() => 'Test User'),
}));

// ── In-memory store stub ──────────────────────────────────────────────

let storeData;

function makeStore() {
  storeData = {};
  return {
    get: vi.fn((key) => storeData[key]),
    set: vi.fn((key, value) => { storeData[key] = value; }),
    has: vi.fn((key) => key in storeData),
    delete: vi.fn((key) => { delete storeData[key]; }),
    clear: vi.fn(() => { storeData = {}; }),
    get store() { return storeData; },
  };
}

// ── Setup ─────────────────────────────────────────────────────────────

let mockStore;
const mockDebugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const fakeEvent = {};

beforeAll(async () => {
  mockStore = makeStore();

  const { initializeIpcHandlers } = await import(
    '../../../src/main/modules/ipc-handlers.js'
  );

  initializeIpcHandlers({
    mainWindow: { webContents: { send: vi.fn() }, isDestroyed: () => false },
    db: null,
    store: mockStore,
    audioInstances: new Map(),
    autoUpdater: null,
    debugLog: mockDebugLog,
    logService: null,
    updateState: { downloaded: false },
  });
});

function invoke(channel, ...args) {
  const fn = handlers[channel];
  if (!fn) throw new Error(`No handler registered for "${channel}"`);
  return fn(fakeEvent, ...args);
}

beforeEach(() => {
  vi.clearAllMocks();
  storeData = {};
});

// ═══════════════════════════════════════════════════════════════════════
// Profile preference sync tests
// ═══════════════════════════════════════════════════════════════════════

describe('profile:set-preferences', () => {
  it('syncs prerelease_updates to global store when saved', async () => {
    const res = await invoke('profile:set-preferences', {
      prerelease_updates: true,
    });

    expect(res.success).toBe(true);
    expect(mockStore.set).toHaveBeenCalledWith('prerelease_updates', true);
    expect(storeData.prerelease_updates).toBe(true);
  });

  it('syncs prerelease_updates=false to global store', async () => {
    storeData.prerelease_updates = true;

    const res = await invoke('profile:set-preferences', {
      prerelease_updates: false,
    });

    expect(res.success).toBe(true);
    expect(mockStore.set).toHaveBeenCalledWith('prerelease_updates', false);
    expect(storeData.prerelease_updates).toBe(false);
  });

  it('does not write prerelease_updates to store when not in preferences', async () => {
    const res = await invoke('profile:set-preferences', {
      fade_out_seconds: 5,
    });

    expect(res.success).toBe(true);
    expect(mockStore.set).not.toHaveBeenCalledWith('prerelease_updates', expect.anything());
  });

  it('saves other preferences without affecting global store', async () => {
    const res = await invoke('profile:set-preferences', {
      fade_out_seconds: 10,
      screen_mode: 'dark',
    });

    expect(res.success).toBe(true);
    expect(storeData).not.toHaveProperty('fade_out_seconds');
    expect(storeData).not.toHaveProperty('screen_mode');
  });
});
