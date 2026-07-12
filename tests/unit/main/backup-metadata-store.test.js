import { describe, expect, it, vi } from 'vitest';
import { createBackupMetadataStore } from '../../../src/main/modules/backup-metadata-store.js';

function createHarness(overrides = {}) {
  const fs = { promises: { readFile: vi.fn(), writeFile: vi.fn() } };
  const coordinator = {
    queueOperation: (_profile, operation) => operation(),
    writeAtomic: vi.fn()
  };
  const store = createBackupMetadataStore({
    fs,
    getMetadataPath: (profile) => `/backups/${profile}/metadata.json`,
    pathExists: vi.fn().mockResolvedValue(false),
    coordinator,
    rebuildMetadata: vi.fn().mockResolvedValue({ backups: [] }),
    getDebugLog: () => null,
    retryDelay: vi.fn(),
    ...overrides
  });
  return { coordinator, fs, store };
}

describe('backup metadata store', () => {
  it('reads and validates primary metadata', async () => {
    const { fs, store } = createHarness();
    fs.promises.readFile.mockResolvedValue(JSON.stringify({ backups: [{ id: 'one' }] }));
    await expect(store.readSafe('Show')).resolves.toEqual({ backups: [{ id: 'one' }] });
  });

  it('restores valid backup metadata after a primary failure', async () => {
    const pathExists = vi.fn().mockResolvedValue(true);
    const { fs, store } = createHarness({ pathExists });
    fs.promises.readFile
      .mockRejectedValueOnce(new Error('corrupt'))
      .mockResolvedValueOnce(JSON.stringify({ backups: [] }));
    await expect(store.readSafe('Show')).resolves.toEqual({ backups: [] });
    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      '/backups/Show/metadata.json', expect.any(String), 'utf8'
    );
  });

  it('rebuilds when primary and backup metadata are unavailable', async () => {
    const rebuildMetadata = vi.fn().mockResolvedValue({ backups: [], rebuilt: true });
    const { fs, store } = createHarness({ rebuildMetadata });
    fs.promises.readFile.mockRejectedValue(new Error('missing'));
    await expect(store.readSafe('Show')).resolves.toMatchObject({ rebuilt: true });
    expect(rebuildMetadata).toHaveBeenCalledWith('Show', expect.any(Error));
  });
});
