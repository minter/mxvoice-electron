// build/notarize.js
import { notarize } from '@electron/notarize';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

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

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env;
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD) {
    console.log('[notarize] Skipping: APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD not set');
    return;
  }

  console.log('[notarize] Submitting for notarization…');
  await notarize({
    appBundleId,
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID, // optional
  });
  console.log('[notarize] Notarization complete');

  // Staple the ticket to the .app
  try {
    console.log('[staple] Stapling ticket to app…');
    execFileSync('xcrun', ['stapler', 'staple', '-v', appPath], { stdio: 'inherit' });
    console.log('[staple] App stapled');
  } catch (e) {
    console.warn('[staple] Failed to staple app (will still try to staple DMG later):', e?.message || e);
  }
}
