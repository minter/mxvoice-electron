// build/afterAllArtifacts.js
import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export default async function afterAllArtifactBuild(context) {
  // electron-builder passes info about the produced artifact
  const { artifactPath, target, packager } = context || {};
  if (process.platform !== 'darwin') {
    // On Windows we still want your existing behavior, so defer to your Windows signer if present
    try {
      if (process.platform === 'win32') {
        const winHook = path.resolve('build/windowsSign.js');
        if (fs.existsSync(winHook)) {
          const mod = await import(`file://${winHook}`);
          if (typeof mod.default === 'function') await mod.default(context);
        }
      }
    } catch (e) {
      console.warn('[afterAllArtifacts] Windows hook error:', e?.message || e);
    }
    return;
  }

  if (!artifactPath || !fs.existsSync(artifactPath)) return;

  const ext = path.extname(artifactPath).toLowerCase();
  if (!['.dmg', '.pkg'].includes(ext)) return;

  // Staple the DMG/PKG
  try {
    console.log(`[staple] Stapling ${ext}…`, artifactPath);
    execFileSync('xcrun', ['stapler', 'staple', '-v', artifactPath], { stdio: 'inherit' });
    console.log('[staple] Stapled:', artifactPath);
  } catch (e) {
    // If notarization was skipped (e.g., creds missing), this will fail — that’s fine.
    console.warn('[staple] Staple failed:', e?.message || e);
  }
}
