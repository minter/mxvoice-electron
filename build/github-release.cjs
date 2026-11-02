// build/github-release.cjs
// Finding a tag's GitHub release, drafts included, for publishWindows.cjs.

/**
 * The release for a tag, or null when there is none. Lists releases rather
 * than using GitHub's get-release-by-tag, which never returns drafts: a draft
 * the macOS publish made would look missing and get a second release. Matches
 * the tag or the bare version, as electron-builder's publisher does.
 *
 * Throws when the tag has more than one release: assets would land on an
 * arbitrary one, and GitHub refuses edits to either until one is deleted.
 *
 * @param {Object} octokit - an @octokit/rest client
 * @param {{ owner: string, repo: string, tag: string, version: string }} target
 * @returns {Promise<Object|null>}
 */
async function findReleaseForTag(octokit, { owner, repo, tag, version }) {
  const releases = await octokit.paginate(octokit.repos.listReleases, { owner, repo, per_page: 100 });
  const matches = releases.filter((release) => release.tag_name === tag || release.tag_name === version);
  if (matches.length > 1) {
    const ids = matches.map((release) => `${release.id}${release.draft ? " (draft)" : ""}`).join(", ");
    throw new Error(
      `${matches.length} GitHub releases exist for ${tag} (ids ${ids}). ` +
      "Delete the extra one on GitHub, keeping the one with the other platform's files, then publish again."
    );
  }
  return matches[0] ?? null;
}

/**
 * Delete an asset of the same name from the release, so a re-run replaces it
 * instead of failing on GitHub's "already_exists".
 *
 * @param {Object} octokit
 * @param {{ owner: string, repo: string, release: Object, name: string }} target
 * @returns {Promise<boolean>} whether an asset was deleted
 */
async function deleteExistingAsset(octokit, { owner, repo, release, name }) {
  const existing = (release.assets ?? []).find((asset) => asset.name === name);
  if (!existing) return false;
  await octokit.repos.deleteReleaseAsset({ owner, repo, asset_id: existing.id });
  return true;
}

module.exports = { findReleaseForTag, deleteExistingAsset };
