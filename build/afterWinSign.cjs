// build/winAfterSign.cjs
const path = require("path");
const fs = require("fs");
const signOne = require("./sslSign.cjs"); // your signer (CommonJS)

module.exports = async function afterSign(context) {
  if (process.platform !== "win32") return;
  const { appOutDir } = context;
  if (!appOutDir || !fs.existsSync(appOutDir)) return;

  const targets = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) {
        const n = e.name.toLowerCase();
        if (n.endsWith(".exe") || n.endsWith(".dll")) targets.push(p);
      }
    }
  })(appOutDir);

  // Sign main exe first if present
  targets.sort((a, b) => {
    const aMain = a.toLowerCase().endsWith(".exe");
    const bMain = b.toLowerCase().endsWith(".exe");
    return aMain === bMain ? 0 : aMain ? -1 : 1;
  });

  for (const file of targets) {
    console.log(`[afterSign] signing ${file}`);
    await signOne(file, context); // your sslSign.cjs accepts (file, context)
  }
};
