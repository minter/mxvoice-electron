import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const preloadSources = ['src/preload/modules/secure-api-exposer.cjs'];

describe('preload filesystem capability surface', () => {
  it.each(preloadSources)('does not expose generic filesystem methods in %s', source => {
    const contents = fs.readFileSync(source, 'utf8');
    for (const channel of ['file-read', 'file-write', 'file-mkdir', 'fs-readdir', 'fs-stat', 'file-get-user-data-path']) {
      expect(contents).not.toContain(`'${channel}'`);
    }
  });

  it.each(preloadSources)('exposes bounded library operations in %s', source => {
    const contents = fs.readFileSync(source, 'utf8');
    expect(contents).toContain('ipcRenderer.invoke(IPC.FILESYSTEM.FILE_COPY');
    expect(contents).toContain('ipcRenderer.invoke(IPC.FILESYSTEM.FILE_DELETE');
    expect(contents).toContain('ipcRenderer.invoke(IPC.FILESYSTEM.SCAN_AUDIO_DIRECTORY');
  });
});
