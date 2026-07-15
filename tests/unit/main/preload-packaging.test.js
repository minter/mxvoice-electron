import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import beforePack, { buildPreload, getPreloadBuildOptions } from '../../../build/build-preload.js';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '../../..');

describe('preload packaging', () => {
  it('uses the same builder for the npm command and electron-builder hook', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

    expect(packageJson.scripts['build:preload']).toBe('node build/build-preload.js');
    expect(packageJson.build.beforePack).toBe('build/build-preload.js');
  });

  it('matches the required Electron preload bundle configuration', () => {
    const options = getPreloadBuildOptions(projectRoot);

    expect(options).toMatchObject({
      absWorkingDir: projectRoot,
      entryPoints: [path.join(projectRoot, 'src/preload/preload-modular.cjs')],
      bundle: true,
      platform: 'node',
      external: ['electron'],
      outfile: path.join(projectRoot, 'src/preload/preload-bundle.cjs'),
      format: 'cjs'
    });
  });

  it('packages the file-path bridge required for OS drag and drop', async () => {
    const bundlePath = path.join(projectRoot, 'src/preload/preload-bundle.cjs');
    fs.writeFileSync(bundlePath, '// intentionally stale preload bundle\n', 'utf8');

    await beforePack({ packager: { projectDir: projectRoot } });

    const bundle = fs.readFileSync(bundlePath, 'utf8');
    expect(bundle).not.toContain('intentionally stale');
    expect(bundle).toContain('getPathForFile');
    expect(bundle).toContain('webUtils.getPathForFile');
  });

  it('propagates preload build failures so packaging stops', async () => {
    const buildFailure = new Error('preload build failed');
    const failingBuild = vi.fn().mockRejectedValue(buildFailure);

    await expect(buildPreload(projectRoot, failingBuild)).rejects.toThrow('preload build failed');
    expect(failingBuild).toHaveBeenCalledOnce();
  });
});
