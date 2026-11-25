// Validate immutable release inputs before electron-builder writes any output.
const fs = require("fs");
const path = require("path");
const { assertEmptyReleaseOutput, resolveReleaseTarget } = require("./release-target.cjs");

const projectDir = process.cwd();

try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf8"));
  const tag = `v${packageJson.version}`;
  const releaseTarget = resolveReleaseTarget(projectDir, tag);
  assertEmptyReleaseOutput(projectDir);
  console.log(`[prepareRelease] Clean detached checkout ${releaseTarget} matches ${tag}`);
  console.log("[prepareRelease] Release output dist/ is empty");
} catch (error) {
  console.error(`[prepareRelease] ${error.message}`);
  process.exit(1);
}
