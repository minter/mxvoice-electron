import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  expectedWindowsArtifactNames,
  resolveWindowsReleaseArtifacts
} = require('../../../build/release-artifacts.cjs');

const packageJson = {
  name: 'mxvoice',
  version: '4.4.0',
  build: { win: { artifactName: 'Mx.-Voice-Setup-${version}.${ext}' } }
};

const file = (name) => ({ name, isFile: () => true });
const directory = (name) => ({ name, isFile: () => false });
const fileSystemWith = (entries) => ({ readdirSync: () => entries });

describe('Windows release artifacts', () => {
  it('derives exact installer and uninstaller names from package configuration', () => {
    expect(expectedWindowsArtifactNames(packageJson)).toEqual({
      installerName: 'Mx.-Voice-Setup-4.4.0.exe',
      uninstallerName: '__uninstaller-nsis-mxvoice.exe'
    });
  });

  it('selects only the exact regular installer and optional uninstaller', () => {
    const artifacts = resolveWindowsReleaseArtifacts('C:\\repo\\dist', packageJson, fileSystemWith([
      file('Mx.-Voice-Setup-4.4.0.exe'),
      file('__uninstaller-nsis-mxvoice.exe'),
      directory('win-unpacked')
    ]));

    expect(artifacts.installerPath).toMatch(/Mx\.-Voice-Setup-4\.4\.0\.exe$/);
    expect(artifacts.uninstallerPath).toMatch(/__uninstaller-nsis-mxvoice\.exe$/);
    expect(artifacts.filesToSign).toEqual([artifacts.installerPath, artifacts.uninstallerPath]);
  });

  it('keeps installer signing valid when electron-builder removes its temporary uninstaller', () => {
    const artifacts = resolveWindowsReleaseArtifacts('C:\\repo\\dist', packageJson, fileSystemWith([
      file('Mx.-Voice-Setup-4.4.0.exe')
    ]));

    expect(artifacts.uninstallerPath).toBeNull();
    expect(artifacts.filesToSign).toEqual([artifacts.installerPath]);
  });

  it('rejects an additional version-matching executable instead of choosing by directory order', () => {
    expect(() => resolveWindowsReleaseArtifacts('/repo/dist', packageJson, fileSystemWith([
      file('Mx.-Voice-Setup-4.4.0.exe'),
      file('poisoned-Setup-4.4.0.exe')
    ]))).toThrow('Unexpected Windows executable(s) in dist/: poisoned-Setup-4.4.0.exe');
  });

  it('rejects a missing or non-regular configured installer', () => {
    expect(() => resolveWindowsReleaseArtifacts('/repo/dist', packageJson, fileSystemWith([])))
      .toThrow('Expected Windows installer Mx.-Voice-Setup-4.4.0.exe was not produced as a regular file');
    expect(() => resolveWindowsReleaseArtifacts('/repo/dist', packageJson, fileSystemWith([
      directory('Mx.-Voice-Setup-4.4.0.exe')
    ]))).toThrow('was not produced as a regular file');
  });

  it('rejects artifact templates that escape dist or use unresolved inputs', () => {
    expect(() => expectedWindowsArtifactNames({
      ...packageJson,
      build: { win: { artifactName: '../Setup-${version}.${ext}' } }
    })).toThrow('must resolve to a filename inside dist/');
    expect(() => expectedWindowsArtifactNames({
      ...packageJson,
      build: { win: { artifactName: 'Setup-${arch}-${version}.${ext}' } }
    })).toThrow('Unsupported Windows artifactName token: arch');
  });
});
