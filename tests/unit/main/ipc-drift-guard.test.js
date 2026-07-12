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

  const preloadDir = 'src/preload/modules';
  const preloadFiles = fs
    .readdirSync(preloadDir)
    .filter(f => f.endsWith('.cjs'))
    .map(f => `${preloadDir}/${f}`);

  it('every preload manifest reference resolves and is registered', () => {
    let totalRefs = 0;
    for (const file of preloadFiles) {
      const src = fs.readFileSync(file, 'utf8');
      const refs = [...src.matchAll(/IPC\.([A-Z0-9_]+)\.([A-Z0-9_]+)/g)];
      totalRefs += refs.length;
      for (const [, domain, name] of refs) {
        const channel = IPC[domain]?.[name];
        expect(channel, `IPC.${domain}.${name} not in manifest (${file})`).toBeDefined();
        expect(registered.has(channel), `${channel} referenced by ${file} but never registered`).toBe(true);
      }
    }
    expect(totalRefs).toBeGreaterThan(90);
  });

  it('preload has no leftover invoke literals', () => {
    for (const file of preloadFiles) {
      const src = fs.readFileSync(file, 'utf8');
      expect(src.includes("ipcRenderer.invoke('"), `${file} has a leftover invoke literal`).toBe(false);
    }
  });

  it('preload has no leftover send literals for manifest-managed channels', () => {
    for (const file of preloadFiles) {
      const src = fs.readFileSync(file, 'utf8');
      const sendRefs = [...src.matchAll(/ipcRenderer\.send\('([^']+)'/g)];
      for (const [, channel] of sendRefs) {
        expect(manifestValues.has(channel), `${file} uses literal '${channel}' for a manifest-managed channel; use an IPC constant`).toBe(false);
      }
    }
  });
});
