/**
 * Drift guard: the channels main registers must exactly match the shared
 * manifest, and every channel preload references must be registered.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'node:fs';

const registered = new Set();

const fakeIpcMain = {
  handle: (channel) => { registered.add(channel); },
  on: (channel) => { registered.add(channel); },
};

vi.mock('electron', () => ({
  default: {
    ipcMain: fakeIpcMain,
    dialog: {},
    app: { getPath: () => '/fake', getAppPath: () => '/fake' },
  },
  ipcMain: fakeIpcMain,
  dialog: {},
  app: { getPath: () => '/fake', getAppPath: () => '/fake' },
}));
vi.mock('../../../src/main/modules/file-operations.js', () => ({
  default: { initializeFileOperations: vi.fn() },
}));
vi.mock('../../../src/main/modules/profile-manager.js', () => ({}));
vi.mock('../../../src/main/modules/profile-backup-manager.js', () => ({}));
vi.mock('../../../src/main/modules/library-transfer-manager.js', () => ({}));
vi.mock('howler', () => ({ Howl: vi.fn(), Howler: {} }));
vi.mock('music-metadata', () => ({ parseFile: vi.fn() }));

import ipcChannels from '../../../src/shared/ipc-channels.cjs';
const { IPC } = ipcChannels;

const manifestValues = new Set(
  Object.values(IPC).flatMap(domain => Object.values(domain))
);

beforeAll(async () => {
  const { initializeIpcHandlers } = await import(
    '../../../src/main/modules/ipc-handlers.js'
  );
  initializeIpcHandlers({
    mainWindow: null,
    getDb: () => null,
    getCurrentProfile: () => 'Test',
    getProfileDirectory: () => '/fake',
    store: { get: vi.fn(), set: vi.fn() },
    audioInstances: new Map(),
    autoUpdater: {},
    debugLog: null,
    logService: null,
    analytics: null,
  });
});

describe('IPC drift guard', () => {
  it('main registers exactly the manifest channels', () => {
    const missing = [...manifestValues].filter(c => !registered.has(c));
    const extra = [...registered].filter(c => !manifestValues.has(c));
    expect(missing, `in manifest but never registered: ${missing}`).toEqual([]);
    expect(extra, `registered but not in manifest: ${extra}`).toEqual([]);
  });

  it('every preload manifest reference resolves and is registered', () => {
    const src = fs.readFileSync('src/preload/modules/secure-api-exposer.cjs', 'utf8');
    const refs = [...src.matchAll(/IPC\.([A-Z_]+)\.([A-Z_]+)/g)];
    expect(refs.length).toBeGreaterThan(90);
    for (const [, domain, name] of refs) {
      const channel = IPC[domain]?.[name];
      expect(channel, `IPC.${domain}.${name} not in manifest`).toBeDefined();
      expect(registered.has(channel), `${channel} referenced by preload but never registered`).toBe(true);
    }
  });

  it('preload has no leftover invoke literals', () => {
    const src = fs.readFileSync('src/preload/modules/secure-api-exposer.cjs', 'utf8');
    expect(src.includes("ipcRenderer.invoke('")).toBe(false);
  });
});
