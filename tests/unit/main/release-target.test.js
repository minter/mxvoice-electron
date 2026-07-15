import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildReleaseCreationOptions,
  resolveReleaseTarget
} = require('../../../build/release-target.cjs');

describe('release target', () => {
  it('targets the exact checked-out commit', () => {
    const runGit = vi.fn().mockReturnValue('535cab792e0eb49f83c17def861fa969ce7f0b3c\n');

    expect(resolveReleaseTarget('/release-worktree', runGit))
      .toBe('535cab792e0eb49f83c17def861fa969ce7f0b3c');
    expect(runGit).toHaveBeenCalledWith('git', ['rev-parse', 'HEAD'], {
      cwd: '/release-worktree',
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  });

  it('rejects invalid git output instead of falling back to the default branch', () => {
    const runGit = vi.fn().mockReturnValue('release/4.3.2\n');

    expect(() => resolveReleaseTarget('/release-worktree', runGit))
      .toThrow('Git returned an invalid release commit: release/4.3.2');
  });

  it('stops publishing when git HEAD cannot be resolved', () => {
    const runGit = vi.fn().mockImplementation(() => {
      throw new Error('not a git repository');
    });

    expect(() => resolveReleaseTarget('/release-worktree', runGit))
      .toThrow('Unable to determine the release commit from git HEAD: not a git repository');
  });

  it('passes the exact commit to GitHub when creating the release', () => {
    expect(buildReleaseCreationOptions({
      owner: 'minter',
      repo: 'mxvoice-electron',
      tag: 'v4.3.2',
      releaseTarget: '535cab792e0eb49f83c17def861fa969ce7f0b3c',
      isDraft: false,
      isPrerelease: true,
      releaseType: 'prerelease'
    })).toEqual({
      owner: 'minter',
      repo: 'mxvoice-electron',
      tag_name: 'v4.3.2',
      target_commitish: '535cab792e0eb49f83c17def861fa969ce7f0b3c',
      name: 'v4.3.2',
      draft: false,
      prerelease: true,
      generate_release_notes: true
    });
  });
});
