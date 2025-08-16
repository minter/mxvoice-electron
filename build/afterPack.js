// build/afterPack.js
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/** Detect Mach-O (and fat) binaries by magic number */
function isMachO(filePath) {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.allocUnsafe(4);
    const n = fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    if (n !== 4) return false;
    const magic = buf.readUInt32BE(0);
    // MH_MAGIC, MH_MAGIC_64, MH_CIGAM, MH_CIGAM_64, FAT_MAGIC, FAT_CIGAM
    return (
      magic === 0xfeedface ||
      magic === 0xfeedfacf ||
      magic === 0xcefaedfe ||
      magic === 0xcffaedfe ||
      magic === 0xcafebabe ||
      magic === 0xbebafeca
    );
  } catch {
    return false;
  }
}

/** Recursively collect file paths */
function walkFiles(rootDir) {
  const out = [];
  const stack = [rootDir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile()) out.push(full);
    }
  }
  return out;
}

/** codesign with hardened runtime & timestamp */
function codesignFile(filePath, identity, entitlements, verbose = false) {
  const args = [
    "--sign", identity,
    "--force",
    "--timestamp",
    "--options", "runtime",
  ];
  if (entitlements && fs.existsSync(entitlements)) {
    args.push("--entitlements", entitlements);
  }
  args.push(filePath);
  if (verbose) console.log(`[afterPack] codesign: ${filePath}`);
  execFileSync("codesign", args, { stdio: verbose ? "inherit" : "ignore" });
}

export default async function afterPack(context) {
  const { electronPlatformName, appOutDir, packager } = context;

  // macOS only
  if (electronPlatformName !== "darwin") return;

  // Allow skipping via env
  if (process.env.SKIP_NESTED_SIGN === "1") {
    if (process.env.NESTED_SIGN_VERBOSE === "1") {
      console.log("[afterPack] SKIP_NESTED_SIGN=1 → skipping nested signing");
    }
    return;
  }

  // Skip universal temp dir (builder runs hook there too)
  if (/mac-universal-.*-x64-temp/.test(appOutDir)) {
    if (process.env.NESTED_SIGN_VERBOSE === "1") {
      console.log("[afterPack] skipping universal temp dir:", appOutDir);
    }
    return;
  }

  const verbose = process.env.NESTED_SIGN_VERBOSE === "1";

  // Resolve .app paths
  const appName = `${packager.appInfo.productFilename}.app`;
  const appPath = path.join(appOutDir, appName);
  const resourcesPath = path.join(appPath, "Contents", "Resources");
  const unpackedDir = path.join(resourcesPath, "app.asar.unpacked");

  if (!fs.existsSync(unpackedDir)) {
    if (verbose) console.log("[afterPack] no app.asar.unpacked directory, nothing to sign");
    return;
  }

  // Identity & entitlements from config/env
  const macOpts = packager.platformSpecificBuildOptions || {};
  const identity =
    macOpts.identity ||
    process.env.CSC_NAME ||
    process.env.CSC_IDENTITY;

  if (!identity) {
    if (verbose) console.log("[afterPack] no signing identity configured; skipping nested signing");
    return;
  }

  const entitlements =
    macOpts.entitlements ||
    path.resolve(packager.projectDir, "build/entitlements.mac.plist");

  // Collect signable files: Mach-O or .node
  const allFiles = walkFiles(unpackedDir);
  const signables = allFiles.filter((p) => p.endsWith(".node") || isMachO(p));

  if (signables.length === 0) {
    if (verbose) console.log("[afterPack] no nested Mach-O/.node files found; nothing to sign");
    return;
  }

  for (const file of signables) {
    try {
      codesignFile(file, identity, entitlements, verbose);
    } catch (err) {
      console.warn(`[afterPack] warning: failed to codesign ${file}: ${err?.message || err}`);
      // If you prefer a hard fail on signing issues, uncomment:
      // throw err;
    }
  }

  if (verbose) console.log(`[afterPack] nested signing complete (${signables.length} file(s))`);
}
