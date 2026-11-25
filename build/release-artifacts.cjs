const fs = require("fs");
const path = require("path");

function renderArtifactName(template, replacements) {
  if (typeof template !== "string" || !template) {
    throw new Error("Windows artifactName must be configured");
  }

  const rendered = template.replace(/\$\{([^}]+)\}/g, (match, token) => {
    if (!(token in replacements)) {
      throw new Error(`Unsupported Windows artifactName token: ${token}`);
    }
    return replacements[token];
  });

  if (path.basename(rendered) !== rendered || rendered === "." || rendered === "..") {
    throw new Error("Windows artifactName must resolve to a filename inside dist/");
  }
  return rendered;
}

function expectedWindowsArtifactNames(packageJson) {
  const version = packageJson?.version;
  const packageName = packageJson?.name;
  if (typeof version !== "string" || !version || typeof packageName !== "string" || !packageName) {
    throw new Error("package.json must define name and version for Windows release artifacts");
  }

  return {
    installerName: renderArtifactName(packageJson.build?.win?.artifactName, { version, ext: "exe" }),
    uninstallerName: `__uninstaller-nsis-${packageName}.exe`
  };
}

function resolveWindowsReleaseArtifacts(distDir, packageJson, fileSystem = fs) {
  const { installerName, uninstallerName } = expectedWindowsArtifactNames(packageJson);
  const expectedExeNames = new Set([installerName, uninstallerName]);
  const entries = fileSystem.readdirSync(distDir, { withFileTypes: true });
  const entriesByName = new Map(entries.map((entry) => [entry.name, entry]));
  const installer = entriesByName.get(installerName);

  if (!installer?.isFile()) {
    throw new Error(`Expected Windows installer ${installerName} was not produced as a regular file`);
  }

  const unexpectedExes = entries
    .filter((entry) => entry.name.toLowerCase().endsWith(".exe") && !expectedExeNames.has(entry.name))
    .map((entry) => entry.name);
  if (unexpectedExes.length > 0) {
    throw new Error(`Unexpected Windows executable(s) in dist/: ${unexpectedExes.join(", ")}`);
  }

  const uninstaller = entriesByName.get(uninstallerName);
  if (uninstaller && !uninstaller.isFile()) {
    throw new Error(`Expected Windows uninstaller path ${uninstallerName} is not a regular file`);
  }

  const installerPath = path.join(distDir, installerName);
  const uninstallerPath = uninstaller ? path.join(distDir, uninstallerName) : null;
  return {
    installerName,
    installerPath,
    uninstallerName,
    uninstallerPath,
    filesToSign: [installerPath, ...(uninstallerPath ? [uninstallerPath] : [])]
  };
}

module.exports = { expectedWindowsArtifactNames, renderArtifactName, resolveWindowsReleaseArtifacts };
