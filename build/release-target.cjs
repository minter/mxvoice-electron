const { execFileSync } = require("child_process");

const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/i;

function resolveReleaseTarget(projectDir = process.cwd(), runGit = execFileSync) {
  let commitSha;

  try {
    commitSha = runGit("git", ["rev-parse", "HEAD"], {
      cwd: projectDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch (error) {
    throw new Error(`Unable to determine the release commit from git HEAD: ${error.message}`);
  }

  if (!COMMIT_SHA_PATTERN.test(commitSha)) {
    throw new Error(`Git returned an invalid release commit: ${commitSha || "(empty)"}`);
  }

  return commitSha;
}

function buildReleaseCreationOptions({
  owner,
  repo,
  tag,
  releaseTarget,
  isDraft,
  isPrerelease,
  releaseType
}) {
  return {
    owner,
    repo,
    tag_name: tag,
    target_commitish: releaseTarget,
    name: tag,
    draft: isDraft,
    prerelease: isPrerelease || releaseType === "prerelease",
    generate_release_notes: true
  };
}

module.exports = { buildReleaseCreationOptions, resolveReleaseTarget };
