import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  assertEmptyReleaseOutput,
  buildReleaseCreationOptions,
  resolveReleaseTarget
} = require('../../../build/release-target.cjs');
const packageJson = require('../../../package.json');

const SHA = '535cab792e0eb49f83c17def861fa969ce7f0b3c';
const OTHER_SHA = '635cab792e0eb49f83c17def861fa969ce7f0b3c';
const TAG = 'v4.4.0';

function releaseGit({ head = SHA, ref = 'HEAD', tagTarget = SHA, status = '' } = {}) {
  return vi.fn((_command, args) => {
    const invocation = args.join(' ');
    if (invocation === 'rev-parse --verify HEAD^{commit}') return `${head}\n`;
    if (invocation === 'rev-parse --abbrev-ref HEAD') return `${ref}\n`;
    if (invocation === `rev-parse --verify refs/tags/${TAG}^{commit}`) return `${tagTarget}\n`;
    if (invocation === 'status --porcelain=v1 --untracked-files=all') return status;
    throw new Error(`unexpected git invocation: ${invocation}`);
  });
}

describe('release target', () => {
  it('accepts a clean detached checkout at the exact version tag', () => {
    const runGit = releaseGit();

    expect(resolveReleaseTarget('/release-worktree', TAG, runGit)).toBe(SHA);
    expect(runGit.mock.calls.map(([, args]) => args)).toEqual([
      ['rev-parse', '--verify', 'HEAD^{commit}'],
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      ['rev-parse', '--verify', `refs/tags/${TAG}^{commit}`],
      ['status', '--porcelain=v1', '--untracked-files=all']
    ]);
  });

  it('rejects a branch checkout even when it points at the tagged commit', () => {
    expect(() => resolveReleaseTarget('/release-worktree', TAG, releaseGit({ ref: 'main' })))
      .toThrow('Release checkout must be detached at v4.4.0; currently on main');
  });

  it('rejects a tag that resolves to a different commit', () => {
    expect(() => resolveReleaseTarget('/release-worktree', TAG, releaseGit({ tagTarget: OTHER_SHA })))
      .toThrow(`Release tag ${TAG} targets ${OTHER_SHA}, not checked-out commit ${SHA}`);
  });

  it('rejects tracked and untracked worktree changes', () => {
    const status = ' M package.json\n?? injected.js';
    expect(() => resolveReleaseTarget('/release-worktree', TAG, releaseGit({ status })))
      .toThrow(`Release checkout must be clean, including untracked files:\n${status}`);
  });

  it('rejects invalid git output instead of falling back to the default branch', () => {
    expect(() => resolveReleaseTarget('/release-worktree', TAG, releaseGit({ head: 'release/4.4.0' })))
      .toThrow('Git returned an invalid release commit: release/4.4.0');
  });

  it('stops publishing when git HEAD cannot be resolved', () => {
    const runGit = vi.fn(() => { throw new Error('not a git repository'); });

    expect(() => resolveReleaseTarget('/release-worktree', TAG, runGit))
      .toThrow('Unable to determine the release commit from git HEAD: not a git repository');
  });

  it('requires the release tag to exist locally', () => {
    const runGit = vi.fn((_command, args) => {
      const invocation = args.join(' ');
      if (invocation === 'rev-parse --verify HEAD^{commit}') return `${SHA}\n`;
      if (invocation === 'rev-parse --abbrev-ref HEAD') return 'HEAD\n';
      if (args[2]?.startsWith('refs/tags/')) throw new Error('unknown revision');
      return '';
    });

    expect(() => resolveReleaseTarget('/release-worktree', TAG, runGit))
      .toThrow('Unable to resolve local release tag v4.4.0: unknown revision');
  });

  it('rejects non-version tag references before invoking git', () => {
    const runGit = vi.fn();
    expect(() => resolveReleaseTarget('/release-worktree', 'v4.4.0^{commit}', runGit))
      .toThrow('A version tag such as v4.4.0 is required for a release');
    expect(runGit).not.toHaveBeenCalled();
  });

  it('passes the exact commit to GitHub when creating the release', () => {
    expect(buildReleaseCreationOptions({
      owner: 'minter',
      repo: 'mxvoice-electron',
      tag: TAG,
      releaseTarget: SHA,
      isDraft: false,
      isPrerelease: true,
      releaseType: 'prerelease'
    })).toEqual({
      owner: 'minter',
      repo: 'mxvoice-electron',
      tag_name: TAG,
      target_commitish: SHA,
      name: TAG,
      draft: false,
      prerelease: true,
      generate_release_notes: true
    });
  });
});

describe('release output', () => {
  it('allows an absent or empty dist directory', () => {
    expect(() => assertEmptyReleaseOutput('/repo', { existsSync: () => false })).not.toThrow();
    expect(() => assertEmptyReleaseOutput('/repo', {
      existsSync: () => true,
      lstatSync: () => ({ isDirectory: () => true, isSymbolicLink: () => false }),
      readdirSync: () => []
    })).not.toThrow();
  });

  it('rejects stale ignored output before packaging', () => {
    expect(() => assertEmptyReleaseOutput('/repo', {
      existsSync: () => true,
      lstatSync: () => ({ isDirectory: () => true, isSymbolicLink: () => false }),
      readdirSync: () => ['Mx.-Voice-Setup-4.4.0.exe']
    })).toThrow('Release output dist/ must be empty before packaging');
  });

  it('rejects a dist symlink', () => {
    expect(() => assertEmptyReleaseOutput('/repo', {
      existsSync: () => true,
      lstatSync: () => ({ isDirectory: () => true, isSymbolicLink: () => true })
    })).toThrow('Release output dist/ must be a real directory');
  });
});

describe('release command wiring', () => {
  it('preflights every publishing command before electron-builder or GitHub access', () => {
    const releaseScripts = Object.entries(packageJson.scripts)
      .filter(([name]) => name.startsWith('release:'));

    expect(releaseScripts.length).toBeGreaterThan(0);
    for (const [, command] of releaseScripts) {
      expect(command.startsWith('node build/prepareRelease.cjs && ')).toBe(true);
    }
  });
});
