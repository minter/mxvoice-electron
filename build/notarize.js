// build/notarize.js
import { notarize } from '@electron/notarize';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export default async function afterSign(context) {
  const { electronPlatformName, appOutDir, packager } = context;
  if (electronPlatformName !== 'darwin') return;

  const appName = packager.appInfo.productFilename;
  const appBundleId = packager.appInfo.appId;
  const appPath = path.join(appOutDir, `${appName}.app`);
  if (!fs.existsSync(appPath)) {
    console.warn('[notarize] App path not found:', appPath);
    return;
  }

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD || process.env.APPLE_ID_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;
  const keychainProfile = process.env.APPLE_NOTARY_KEYCHAIN_PROFILE || 'AC_NOTARY';

  if (!teamId) {
    console.error('[notarize] APPLE_TEAM_ID is required for reliability.');
    return;
  }
  if (!appleIdPassword && !process.env.APPLE_NOTARY_KEYCHAIN_PROFILE && keychainProfile !== 'AC_NOTARY') {
    console.error('[notarize] No Apple credentials provided.');
    return;
  }

  // Prefer stored keychain credentials if present
  const baseOpts = {
    appBundleId,
    appPath,
    tool: 'notarytool',
    ...(process.env.APPLE_NOTARY_KEYCHAIN_PROFILE
      ? { keychainProfile: process.env.APPLE_NOTARY_KEYCHAIN_PROFILE }
      : (process.env.AC_NOTARY // allow default profile name if user used it
          ? { keychainProfile: 'AC_NOTARY' }
          : { appleId, appleIdPassword, teamId }
        )
    )
  };

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[notarize] Submitting (attempt ${attempt}/${maxAttempts})…`);
      await notarize(baseOpts);
      console.log('[notarize] Notarization complete');

      console.log('[staple] Stapling .app…');
      execFileSync('xcrun', ['stapler', 'staple', '-v', appPath], { stdio: 'inherit' });
      console.log('[staple] App stapled');
      return;
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      const isTransient =
        /HTTP status code:\s*5\d\d/.test(msg) ||
        /The operation couldn’t be completed/.test(msg) ||
        /A server with the specified hostname could not be found/.test(msg);

      console.warn(`[notarize] Attempt ${attempt} failed: ${msg}`);
      if (attempt < maxAttempts && isTransient) {
        const delay = attempt * 15000; // 15s, 30s
        console.log(`[notarize] Retrying in ${delay / 1000}s…`);
        await sleep(delay);
        continue;
      }
      throw e; // non-transient or exhausted
    }
  }
}
