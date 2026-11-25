import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  assertReleaseAssetsAvailable,
  ensureRelease,
  findReleaseForTag,
  releaseNotesBody,
  resolveRemoteTagCommit
} = require('../../../build/github-release.cjs');

const target = { owner: 'minter', repo: 'mxvoice-electron', tag: 'v4.4.0-beta.2', version: '4.4.0-beta.2' };
const SHA = '535cab792e0eb49f83c17def861fa969ce7f0b3c';

function octokitWith(releases) {
  const listReleases = vi.fn();
  return {
    listReleases,
    octokit: {
      repos: {
        listReleases,
        createRelease: vi.fn(async (options) => ({ data: { id: 500, tag_name: options.tag_name, draft: options.draft, prerelease: options.prerelease, assets: [] } })),
        updateRelease: vi.fn(async ({ release_id, ...flags }) => ({ data: { id: release_id, tag_name: 'v4.4.0-beta.2', draft: false, prerelease: false, ...flags } }))
      },
      git: {
        getRef: vi.fn().mockResolvedValue({ data: { object: { type: 'commit', sha: SHA } } }),
        getTag: vi.fn()
      },
      paginate: vi.fn().mockResolvedValue(releases)
    }
  };
}

describe('findReleaseForTag', () => {
  it('finds a draft release, which get-release-by-tag would miss', async () => {
    const draft = { id: 1, tag_name: 'v4.4.0-beta.2', draft: true };
    const { octokit, listReleases } = octokitWith([{ id: 9, tag_name: 'v4.3.2' }, draft]);

    await expect(findReleaseForTag(octokit, target)).resolves.toBe(draft);
    // Every page, not just the first
    expect(octokit.paginate).toHaveBeenCalledWith(listReleases, { owner: 'minter', repo: 'mxvoice-electron', per_page: 100 });
  });

  it('matches a release tagged with the bare version too, as electron-builder does', async () => {
    const bare = { id: 2, tag_name: '4.4.0-beta.2' };
    const { octokit } = octokitWith([bare]);
    await expect(findReleaseForTag(octokit, target)).resolves.toBe(bare);
  });

  it('returns null when the tag has no release', async () => {
    const { octokit } = octokitWith([{ id: 9, tag_name: 'v4.3.2' }]);
    await expect(findReleaseForTag(octokit, target)).resolves.toBeNull();
  });

  it('stops when the tag has more than one release, naming them', async () => {
    const { octokit } = octokitWith([
      { id: 432071170, tag_name: 'v4.4.0-beta.2', draft: false },
      { id: 432071169, tag_name: 'v4.4.0-beta.2', draft: true }
    ]);
    await expect(findReleaseForTag(octokit, target)).rejects.toThrow(/2 GitHub releases exist for v4\.4\.0-beta\.2 \(ids 432071170, 432071169 \(draft\)\)/);
  });
});

describe('remote release tag', () => {
  it('dereferences an annotated GitHub tag to its commit', async () => {
    const { octokit } = octokitWith([]);
    octokit.git.getRef.mockResolvedValue({ data: { object: { type: 'tag', sha: 'tag-object-sha' } } });
    octokit.git.getTag.mockResolvedValue({ data: { object: { type: 'commit', sha: SHA } } });

    await expect(resolveRemoteTagCommit(octokit, { ...target, tag: target.tag })).resolves.toBe(SHA);
    expect(octokit.git.getTag).toHaveBeenCalledWith({
      owner: target.owner,
      repo: target.repo,
      tag_sha: 'tag-object-sha'
    });
  });

  it('reports an absent remote tag without substituting a branch', async () => {
    const { octokit } = octokitWith([]);
    octokit.git.getRef.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
    await expect(resolveRemoteTagCommit(octokit, { ...target, tag: target.tag })).resolves.toBeNull();
  });
});

describe('release assets', () => {
  it('rejects replacing any existing same-named asset', () => {
    const release = { id: 1, assets: [{ id: 77, name: 'latest.yml' }, { id: 78, name: 'Setup.exe' }] };

    expect(() => assertReleaseAssetsAvailable(release, ['Setup.exe', 'latest.yml']))
      .toThrow('Refusing to replace existing release asset(s): Setup.exe, latest.yml');
  });

  it('allows a first upload and additions from another platform', () => {
    const release = { id: 1, assets: [{ id: 70, name: 'Mx.-Voice-4.4.0-universal.dmg' }] };
    expect(() => assertReleaseAssetsAvailable(release, ['Mx.-Voice-Setup-4.4.0.exe', 'latest.yml']))
      .not.toThrow();
  });
});

const publish = (mode) => ({
  ...target,
  releaseTarget: SHA,
  isDraft: mode === 'draft',
  isPrerelease: mode === 'prerelease',
  releaseType: mode === 'prerelease' ? 'prerelease' : 'release'
});

describe('ensureRelease', () => {
  it('creates the release at the checked-out commit when no platform has published yet', async () => {
    const { octokit } = octokitWith([]);
    const { release, created } = await ensureRelease(octokit, { ...publish('prerelease'), body: 'Notes' });

    expect(created).toBe(true);
    expect(release.id).toBe(500);
    expect(octokit.repos.createRelease).toHaveBeenCalledWith(expect.objectContaining({
      tag_name: 'v4.4.0-beta.2',
      target_commitish: SHA,
      draft: false,
      prerelease: true,
      body: 'Notes',
      generate_release_notes: false
    }));
  });

  it('creates a draft for a draft publish', async () => {
    const { octokit } = octokitWith([]);
    await ensureRelease(octokit, publish('draft'));
    expect(octokit.repos.createRelease).toHaveBeenCalledWith(expect.objectContaining({ draft: true, generate_release_notes: true }));
  });

  it('creates a release when the exact local tag has not been pushed yet', async () => {
    const { octokit } = octokitWith([]);
    octokit.git.getRef.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));

    await expect(ensureRelease(octokit, publish('release'))).resolves.toMatchObject({ created: true });
    expect(octokit.repos.createRelease).toHaveBeenCalledWith(expect.objectContaining({ target_commitish: SHA }));
  });

  // Whichever platform went first, the second reuses its release
  for (const [existing, mode] of [
    [{ draft: true, prerelease: false }, 'draft'],
    [{ draft: true, prerelease: true }, 'prerelease'],
    [{ draft: false, prerelease: true }, 'prerelease'],
    [{ draft: false, prerelease: false }, 'release']
  ]) {
    it(`reuses an existing ${existing.draft ? 'draft' : 'published'} release for a ${mode} publish, unchanged`, async () => {
      const release = { id: 7, tag_name: 'v4.4.0-beta.2', ...existing };
      const { octokit } = octokitWith([release]);
      const result = await ensureRelease(octokit, publish(mode));

      expect(result).toEqual({ release, created: false });
      expect(octokit.repos.createRelease).not.toHaveBeenCalled();
      expect(octokit.repos.updateRelease).not.toHaveBeenCalled();
    });
  }

  it('keeps a draft a draft when a prerelease publish adds to it, marking it prerelease', async () => {
    const { octokit } = octokitWith([{ id: 7, tag_name: 'v4.4.0-beta.2', draft: true, prerelease: false }]);
    await ensureRelease(octokit, publish('prerelease'));
    expect(octokit.repos.updateRelease).toHaveBeenCalledTimes(1);
    expect(octokit.repos.updateRelease).toHaveBeenCalledWith({ owner: 'minter', repo: 'mxvoice-electron', release_id: 7, prerelease: true });
  });

  it('turns a published release back into a draft for a draft publish', async () => {
    const { octokit } = octokitWith([{ id: 7, tag_name: 'v4.4.0-beta.2', draft: false, prerelease: true }]);
    const { release } = await ensureRelease(octokit, publish('draft'));
    expect(octokit.repos.updateRelease).toHaveBeenCalledWith({ owner: 'minter', repo: 'mxvoice-electron', release_id: 7, draft: true });
    expect(release.draft).toBe(true);
  });

  it('rejects an existing release whose tag targets another commit', async () => {
    const existing = { id: 7, tag_name: 'v4.4.0-beta.2', draft: true, prerelease: false };
    const { octokit } = octokitWith([existing]);
    octokit.git.getRef.mockResolvedValue({
      data: { object: { type: 'commit', sha: '635cab792e0eb49f83c17def861fa969ce7f0b3c' } }
    });

    await expect(ensureRelease(octokit, publish('prerelease')))
      .rejects.toThrow('not checked-out release commit');
    expect(octokit.repos.createRelease).not.toHaveBeenCalled();
    expect(octokit.repos.updateRelease).not.toHaveBeenCalled();
  });

  it('rejects an existing release whose tag is missing', async () => {
    const existing = { id: 7, tag_name: 'v4.4.0-beta.2', draft: true, prerelease: false };
    const { octokit } = octokitWith([existing]);
    octokit.git.getRef.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));

    await expect(ensureRelease(octokit, publish('prerelease')))
      .rejects.toThrow('GitHub release 7 refers to missing tag v4.4.0-beta.2');
  });

  it('stops before creating anything when the tag already has two releases', async () => {
    const { octokit } = octokitWith([{ id: 1, tag_name: 'v4.4.0-beta.2' }, { id: 2, tag_name: 'v4.4.0-beta.2' }]);
    await expect(ensureRelease(octokit, publish('prerelease'))).rejects.toThrow(/2 GitHub releases exist/);
    expect(octokit.repos.createRelease).not.toHaveBeenCalled();
  });
});

describe('releaseNotesBody', () => {
  it('reads docs/release-notes/v<version>.md', () => {
    const readFile = vi.fn(() => '## Notes\n\n');
    expect(releaseNotesBody('/repo', '4.4.0-beta.2', readFile)).toBe('## Notes');
    expect(readFile).toHaveBeenCalledWith(expect.stringMatching(/docs[\\/]release-notes[\\/]v4\.4\.0-beta\.2\.md$/), 'utf8');
  });

  it('is null without a notes file, or with an empty one', () => {
    const missing = () => { throw Object.assign(new Error('nope'), { code: 'ENOENT' }); };
    expect(releaseNotesBody('/repo', '4.4.0', missing)).toBeNull();
    expect(releaseNotesBody('/repo', '4.4.0', () => '  \n')).toBeNull();
  });

  it('reports a notes file it cannot read', () => {
    const denied = () => { throw Object.assign(new Error('EACCES'), { code: 'EACCES' }); };
    expect(() => releaseNotesBody('/repo', '4.4.0', denied)).toThrow('EACCES');
  });
});
