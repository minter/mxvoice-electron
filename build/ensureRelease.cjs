// build/ensureRelease.cjs
// Make sure the version's GitHub release exists, with the flags this publish
// asks for, before electron-builder uploads to it (macOS and Linux).
//
// electron-builder creates the release itself when there is none, but it
// races: two artifacts finishing together each create a release (4.4.0-beta.1
// got two). It also creates it without a target commit, so a tag that doesn't
// exist yet is cut from the default branch. With the release already there,
// every upload finds it.
//
// Usage: node build/ensureRelease.cjs [--draft] [--prerelease]
// (EP_DRAFT=true / EP_PRE_RELEASE=true work too.) Needs GH_TOKEN or GITHUB_TOKEN.
const { Octokit } = require("@octokit/rest");
const fs = require("fs");
const path = require("path");
const { resolveReleaseTarget } = require("./release-target.cjs");
const { ensureRelease, releaseNotesBody } = require("./github-release.cjs");

const projectDir = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf8"));
const version = packageJson.version;
const publishConfig = packageJson.build?.publish?.[0];

if (!publishConfig || publishConfig.provider !== "github") {
  console.error("[ensureRelease] GitHub publish configuration not found");
  process.exit(1);
}

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) {
  console.error("[ensureRelease] GitHub token not found. Set GH_TOKEN or GITHUB_TOKEN environment variable.");
  process.exit(1);
}

const args = process.argv.slice(2);
const isDraft = args.includes("--draft") || process.env.EP_DRAFT === "true";
const isPrerelease = args.includes("--prerelease") || process.env.EP_PRE_RELEASE === "true";
const releaseType = isPrerelease ? "prerelease" : (publishConfig.releaseType || "release");

(async () => {
  try {
    const { release } = await ensureRelease(new Octokit({ auth: token }), {
      owner: publishConfig.owner,
      repo: publishConfig.repo,
      tag: `v${version}`,
      version,
      releaseTarget: resolveReleaseTarget(projectDir),
      isDraft,
      isPrerelease,
      releaseType,
      body: releaseNotesBody(projectDir, version),
      log: (message) => console.log(`[ensureRelease] ${message}`)
    });
    console.log(`[ensureRelease] ✅ Release ${release.id} is ready (draft=${release.draft}, prerelease=${release.prerelease})`);
  } catch (error) {
    console.error("[ensureRelease] ❌", error.message);
    process.exit(1);
  }
})();
