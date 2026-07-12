import { describe, expect, it, vi } from 'vitest';
import { createBackupMetadataCoordinator } from '../../../src/main/modules/backup-metadata-coordinator.js';

function createHarness(overrides = {}) {
  const fs = {
    constants: { F_OK: 1, R_OK: 2 },
    promises: {
      writeFile: vi.fn(), access: vi.fn(), rename: vi.fn(), unlink: vi.fn()
    }
  };
  const coordinator = createBackupMetadataCoordinator({
    fs,
    getMetadataPath: (profile) => `/backups/${profile}/metadata.json`,
    pathExists: vi.fn().mockResolvedValue(false),
    getDebugLog: () => null,
    ...overrides
  });
  return { coordinator, fs };
}

describe('backup metadata coordinator', () => {
  it('writes through a verified temporary file before renaming', async () => {
    const { coordinator, fs } = createHarness();
    await coordinator.writeAtomic('/metadata.json', { backups: [] });
    expect(fs.promises.writeFile).toHaveBeenCalledWith('/metadata.json.tmp', expect.any(String), 'utf8');
    expect(fs.promises.rename).toHaveBeenCalledWith('/metadata.json.tmp', '/metadata.json');
    expect(fs.promises.access).toHaveBeenCalledTimes(2);
  });

  it('always removes the profile lock after an operation', async () => {
    const { coordinator, fs } = createHarness();
    await expect(coordinator.withLock('Show', async () => 'done')).resolves.toBe('done');
    expect(fs.promises.unlink).toHaveBeenCalledWith('/backups/Show/metadata.json.lock');
  });

  it('serializes queued operations for the same profile', async () => {
    const { coordinator } = createHarness();
    const order = [];
    let releaseFirst;
    let signalFirstStarted;
    const firstStarted = new Promise((resolve) => { signalFirstStarted = resolve; });
    const first = coordinator.queueOperation('Show', async () => {
      order.push('first-start');
      signalFirstStarted();
      await new Promise((resolve) => { releaseFirst = resolve; });
      order.push('first-end');
    });
    const second = coordinator.queueOperation('Show', async () => { order.push('second'); });
    await firstStarted;
    expect(order).toEqual(['first-start']);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(['first-start', 'first-end', 'second']);
  });
});
