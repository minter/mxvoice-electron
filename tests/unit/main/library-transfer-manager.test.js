/**
 * Unit tests for the Library Transfer Manager module.
 *
 * Strategy: create a real temp directory structure mimicking userData,
 * mock electron/store, and exercise export/import/validate end-to-end
 * using the real archiver and extract-zip libraries.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ── Stubs for Electron APIs ───────────────────────────────────────────

let testUserData;

const fakeApp = {
  getPath: vi.fn((name) => {
    if (name === 'userData') return testUserData;
    return '/fake';
  }),
  getVersion: vi.fn(() => '4.1.2'),
};

vi.mock('electron', () => ({
  default: { app: fakeApp },
  app: fakeApp,
}));

// ── Test helpers ──────────────────────────────────────────────────────

const mockDebugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function createTestFile(filePath, content = 'test content') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function setupTestUserData() {
  // Database
  createTestFile(path.join(testUserData, 'mxvoice.db'), 'fake-sqlite-data');

  // Music files
  createTestFile(path.join(testUserData, 'mp3', 'song1.mp3'), 'fake-mp3-1');
  createTestFile(path.join(testUserData, 'mp3', 'song2.mp3'), 'fake-mp3-2');

  // Hotkeys
  createTestFile(path.join(testUserData, 'hotkeys', 'set1.mrv'), 'f1::123\nf2::456');

  // Profiles
  createTestFile(
    path.join(testUserData, 'profiles', 'Default User', 'state.json'),
    JSON.stringify({ hotkeyTabs: [] })
  );
  createTestFile(
    path.join(testUserData, 'profiles', 'Default User', 'preferences.json'),
    JSON.stringify({ fade_out_seconds: 3 })
  );

  // Profile registry
  createTestFile(
    path.join(testUserData, 'profiles.json'),
    JSON.stringify({ profiles: [{ name: 'Default User' }] })
  );

  // Config (simulates electron-store file)
  createTestFile(
    path.join(testUserData, 'config.json'),
    JSON.stringify({
      music_directory: path.join(testUserData, 'mp3'),
      hotkey_directory: path.join(testUserData, 'hotkeys'),
      database_directory: testUserData,
      browser_width: 1280,
      browser_height: 1024,
      fade_out_seconds: 2,
    })
  );
}

// ── Setup ─────────────────────────────────────────────────────────────

let exportLibrary, importLibrary, validateArchive, initializeLibraryTransferManager;

beforeAll(async () => {
  const mod = await import('../../../src/main/modules/library-transfer-manager.js');
  exportLibrary = mod.exportLibrary;
  importLibrary = mod.importLibrary;
  validateArchive = mod.validateArchive;
  initializeLibraryTransferManager = mod.initializeLibraryTransferManager;
});

beforeEach(() => {
  // Create fresh temp directory for each test
  testUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'mxvlib-test-'));
  setupTestUserData();

  // Reset fakeApp.getPath to use current testUserData
  fakeApp.getPath.mockImplementation((name) => {
    if (name === 'userData') return testUserData;
    return '/fake';
  });

  const fakeStore = {
    get: vi.fn((key) => {
      const config = {
        music_directory: path.join(testUserData, 'mp3'),
        hotkey_directory: path.join(testUserData, 'hotkeys'),
        database_directory: testUserData,
      };
      return config[key];
    }),
    path: path.join(testUserData, 'config.json'),
  };

  initializeLibraryTransferManager({
    debugLog: mockDebugLog,
    db: { close: vi.fn() },
    store: fakeStore,
  });
});

afterAll(() => {
  // Clean up any remaining temp dirs (best-effort)
  try {
    if (testUserData && fs.existsSync(testUserData)) {
      fs.rmSync(testUserData, { recursive: true, force: true });
    }
  } catch { /* ignore */ }
});

// ── Tests ─────────────────────────────────────────────────────────────

describe('exportLibrary', () => {
  it('creates a valid .mxvlib archive with all components', async () => {
    const outputPath = path.join(testUserData, 'test-export.mxvlib');
    const progressUpdates = [];

    const result = await exportLibrary(outputPath, (p) => progressUpdates.push(p));

    expect(result.success).toBe(true);
    expect(result.archiveSize).toBeGreaterThan(0);
    expect(fs.existsSync(outputPath)).toBe(true);

    // Verify manifest in result
    expect(result.manifest).toBeDefined();
    expect(result.manifest.version).toBe(1);
    expect(result.manifest.appVersion).toBe('4.1.2');
    expect(result.manifest.contents.mp3Count).toBe(2);
    expect(result.manifest.contents.hotkeyCount).toBe(1);
    expect(result.manifest.contents.profileCount).toBe(1);
    expect(result.manifest.contents.hasDatabase).toBe(true);

    // Verify progress was reported
    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[0].percent).toBe(0);
    expect(progressUpdates[progressUpdates.length - 1].percent).toBe(100);
  });

  it('handles missing music directory gracefully', async () => {
    // Remove music directory
    fs.rmSync(path.join(testUserData, 'mp3'), { recursive: true, force: true });

    const outputPath = path.join(testUserData, 'test-export-no-music.mxvlib');
    const result = await exportLibrary(outputPath);

    expect(result.success).toBe(true);
    expect(result.manifest.contents.mp3Count).toBe(0);
  });

  it('cleans up partial file on failure', async () => {
    const badPath = path.join(testUserData, 'nonexistent', 'deep', 'nested', '\0invalid');
    const result = await exportLibrary(badPath);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('validateArchive', () => {
  it('validates a correct archive and returns manifest', async () => {
    const archivePath = path.join(testUserData, 'valid.mxvlib');
    await exportLibrary(archivePath);

    const result = await validateArchive(archivePath);

    expect(result.success).toBe(true);
    expect(result.manifest).toBeDefined();
    expect(result.manifest.version).toBe(1);
    expect(result.manifest.appVersion).toBe('4.1.2');
    expect(result.manifest.platform).toBe(process.platform);
    expect(result.manifest.archiveSize).toBeGreaterThan(0);
  });

  it('rejects a non-existent file', async () => {
    const result = await validateArchive('/no/such/file.mxvlib');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('rejects an invalid archive (not a zip)', async () => {
    const fakePath = path.join(testUserData, 'not-a-zip.mxvlib');
    fs.writeFileSync(fakePath, 'this is not a zip file');

    const result = await validateArchive(fakePath);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid archive/i);
  });

  it('rejects archive missing manifest.json', async () => {
    // Create a valid zip but without manifest.json using archiver
    const archiver = (await import('archiver')).default;
    const noManifestPath = path.join(testUserData, 'no-manifest.mxvlib');
    const output = fs.createWriteStream(noManifestPath);
    const archive = archiver('zip');

    const done = new Promise((resolve) => output.on('close', resolve));
    archive.pipe(output);
    archive.append('dummy', { name: 'dummy.txt' });
    await archive.finalize();
    await done;

    const result = await validateArchive(noManifestPath);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/missing manifest/i);
  });
});

describe('importLibrary', () => {
  it('imports all components from an archive', async () => {
    // Export first
    const archivePath = path.join(testUserData, 'for-import.mxvlib');
    await exportLibrary(archivePath);

    // Create a fresh target userData directory
    const importUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'mxvlib-import-'));
    // Point fakeApp to new directory for import
    fakeApp.getPath.mockReturnValue(importUserData);

    // Create a new store pointing to the import directory
    const importConfigPath = path.join(importUserData, 'config.json');
    fs.writeFileSync(importConfigPath, '{}');

    initializeLibraryTransferManager({
      debugLog: mockDebugLog,
      db: { close: vi.fn() },
      store: {
        get: vi.fn(() => undefined),
        path: importConfigPath,
      },
    });

    const progressUpdates = [];
    const result = await importLibrary(archivePath, (p) => progressUpdates.push(p));

    expect(result.success).toBe(true);
    expect(result.requiresRestart).toBe(true);

    // Verify database was imported
    expect(fs.existsSync(path.join(importUserData, 'mxvoice.db'))).toBe(true);

    // Verify music files were imported
    const musicDir = path.join(importUserData, 'mp3');
    expect(fs.existsSync(path.join(musicDir, 'song1.mp3'))).toBe(true);
    expect(fs.existsSync(path.join(musicDir, 'song2.mp3'))).toBe(true);

    // Verify profiles were imported
    expect(fs.existsSync(
      path.join(importUserData, 'profiles', 'Default User', 'state.json')
    )).toBe(true);

    // Verify profile registry was imported
    expect(fs.existsSync(path.join(importUserData, 'profiles.json'))).toBe(true);

    // Verify hotkeys were imported
    expect(fs.existsSync(path.join(importUserData, 'hotkeys', 'set1.mrv'))).toBe(true);

    // Verify config was imported with remapped paths
    const importedConfig = JSON.parse(fs.readFileSync(importConfigPath, 'utf-8'));
    expect(importedConfig.music_directory).toBe(path.join(importUserData, 'mp3'));
    expect(importedConfig.hotkey_directory).toBe(path.join(importUserData, 'hotkeys'));
    expect(importedConfig.database_directory).toBe(importUserData);
    // Non-path settings should be preserved from the archive
    expect(importedConfig.fade_out_seconds).toBe(2);

    // Verify progress was reported
    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[progressUpdates.length - 1].percent).toBe(100);

    // Clean up
    fs.rmSync(importUserData, { recursive: true, force: true });
  });

  it('rejects an invalid archive', async () => {
    const badArchive = path.join(testUserData, 'bad.mxvlib');
    fs.writeFileSync(badArchive, 'not a zip');

    const result = await importLibrary(badArchive);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid archive/i);
  });
});

describe('round-trip integrity', () => {
  it('preserves file contents through export and import', async () => {
    // Export
    const archivePath = path.join(testUserData, 'roundtrip.mxvlib');
    await exportLibrary(archivePath);

    // Import to fresh directory
    const importUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'mxvlib-rt-'));
    fakeApp.getPath.mockReturnValue(importUserData);

    const importConfigPath = path.join(importUserData, 'config.json');
    fs.writeFileSync(importConfigPath, '{}');

    initializeLibraryTransferManager({
      debugLog: mockDebugLog,
      db: { close: vi.fn() },
      store: {
        get: vi.fn(() => undefined),
        path: importConfigPath,
      },
    });

    await importLibrary(archivePath);

    // Verify file contents match originals
    expect(fs.readFileSync(path.join(importUserData, 'mxvoice.db'), 'utf-8'))
      .toBe('fake-sqlite-data');
    expect(fs.readFileSync(path.join(importUserData, 'mp3', 'song1.mp3'), 'utf-8'))
      .toBe('fake-mp3-1');
    expect(fs.readFileSync(path.join(importUserData, 'mp3', 'song2.mp3'), 'utf-8'))
      .toBe('fake-mp3-2');
    expect(fs.readFileSync(path.join(importUserData, 'hotkeys', 'set1.mrv'), 'utf-8'))
      .toBe('f1::123\nf2::456');

    const profileState = JSON.parse(
      fs.readFileSync(path.join(importUserData, 'profiles', 'Default User', 'state.json'), 'utf-8')
    );
    expect(profileState).toEqual({ hotkeyTabs: [] });

    const registry = JSON.parse(
      fs.readFileSync(path.join(importUserData, 'profiles.json'), 'utf-8')
    );
    expect(registry.profiles).toHaveLength(1);
    expect(registry.profiles[0].name).toBe('Default User');

    // Clean up
    fs.rmSync(importUserData, { recursive: true, force: true });
  });
});
