// build/winSignInstaller.cjs
const signOne = require("./sslSign.cjs");

module.exports = async function artifactBuildCompleted(context) {
  if (process.platform !== "win32") return;
  const { file, target } = context;
  if (!file) return;

  const t = target?.name;
  const isWinInstaller = file.toLowerCase().endsWith(".exe") &&
    (t === "nsis" || t === "squirrel" || t === "portable");

  if (!isWinInstaller) return;

  console.log(`[artifactBuildCompleted] signing installer ${file}`);
  await signOne(file, context);
};
