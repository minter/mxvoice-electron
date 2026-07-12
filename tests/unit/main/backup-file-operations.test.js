import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { createBackupFileOperations } from '../../../src/main/modules/backup-file-operations.js';

describe('backup file operations', () => {
  it('recursively copies directories and files', async () => {
    const fs = { promises: {
      mkdir: vi.fn(),
      readdir: vi.fn(async (directory) => directory === '/source'
        ? [{ name: 'nested', isDirectory: () => true }, { name: 'one.json', isDirectory: () => false }]
        : [{ name: 'two.json', isDirectory: () => false }]),
      copyFile: vi.fn()
    } };
    const operations = createBackupFileOperations({ fs, path });
    await operations.copyDirectory('/source', '/backup');
    expect(fs.promises.mkdir).toHaveBeenCalledTimes(2);
    expect(fs.promises.copyFile).toHaveBeenCalledWith('/source/one.json', '/backup/one.json');
    expect(fs.promises.copyFile).toHaveBeenCalledWith('/source/nested/two.json', '/backup/nested/two.json');
  });

  it('removes directories idempotently', async () => {
    const fs = { promises: { rm: vi.fn() } };
    const operations = createBackupFileOperations({ fs, path });
    await operations.removeDirectory('/backup');
    expect(fs.promises.rm).toHaveBeenCalledWith('/backup', { recursive: true, force: true });
  });
});
