import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuild } from 'esbuild';

const scriptPath = fileURLToPath(import.meta.url);

export function getPreloadBuildOptions(projectDir = process.cwd()) {
  const rootDir = path.resolve(projectDir);

  return {
    absWorkingDir: rootDir,
    entryPoints: [path.join(rootDir, 'src/preload/preload-modular.cjs')],
    bundle: true,
    platform: 'node',
    external: ['electron'],
    outfile: path.join(rootDir, 'src/preload/preload-bundle.cjs'),
    format: 'cjs',
    logLevel: 'info'
  };
}

export async function buildPreload(projectDir = process.cwd(), buildImplementation = esbuild) {
  const options = getPreloadBuildOptions(projectDir);
  await buildImplementation(options);
  return options.outfile;
}

/**
 * electron-builder beforePack hook. Building here guarantees every packaging
 * entry point receives a bundle generated from the source being packaged.
 */
export default async function beforePack(context) {
  const projectDir = context?.packager?.projectDir || process.cwd();
  // eslint-disable-next-line no-console
  console.log('[beforePack] Building preload bundle from current source');
  await buildPreload(projectDir);
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  await buildPreload(process.cwd());
}
