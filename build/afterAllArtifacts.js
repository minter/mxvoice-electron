// build/afterAllArtifacts.js
import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';

function submitNotarization(artifactPath) {
  const hasProfile = !!process.env.APPLE_NOTARY_KEYCHAIN_PROFILE || true; // default to AC_NOTARY if created
  const profile = process.env.APPLE_NOTARY_KEYCHAIN_PROFILE || 'AC_NOTARY';

  const args = ['notarytool', 'submit', artifactPath, '--wait'];
  if (hasProfile) {
    args.push('--keychain-profile', profile);
  } else {
    const appleId = process.env.APPLE_ID;
    const password = process.env.APPLE_APP_SPECIFIC_PASSWORD || process.env.APPLE_ID_PASSWORD;
    const teamId = process.env.APPLE_TEAM_ID;
    if (!appleId || !password || !teamId) {
      throw new Error('Apple notarization credentials missing (APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID).');
    }
    args.push('--apple-id', appleId, '--team-id', teamId, '--password', password);
  }
  console.log('[notarytool] submit', artifactPath);
  execFileSync('xcrun', args, { stdio: 'inherit' });
}

function staple(artifactPath) {
  console.log('[staple] Stapling', artifactPath);
  execFileSync('xcrun', ['stapler', 'staple', '-v', artifactPath], { stdio: 'inherit' });
}

export default async function afterAllArtifactBuild(context) {
  const { artifactPath } = context || {};
  if (!artifactPath || process.platform !== 'darwin') return;

  const ext = path.extname(artifactPath).toLowerCase();
  if (!['.dmg', '.pkg'].includes(ext)) return; // ZIPs cannot be stapled

  if (!fs.existsSync(artifactPath)) {
    console.warn('[afterAllArtifacts] Missing artifact:', artifactPath);
    return;
  }

  try {
    submitNotarization(artifactPath);
  } catch (e) {
    console.warn('[notarytool] submit failed (DMG may already be notarized, or creds missing):', e?.message || e);
  }

  try {
    staple(artifactPath);
  } catch (e) {
    console.warn('[staple] Failed to staple:', e?.message || e);
  }
}
