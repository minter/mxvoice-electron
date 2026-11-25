import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  allowInstallAfterUserApproval,
  configureUpdateSecurity,
  disableAutomaticUpdateInstall,
} from '../../../src/main/modules/update-security.js';

describe('update authenticity configuration', () => {
  it('pins Windows updater verification to the documented signing identity', () => {
    const packageJson = JSON.parse(fs.readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));

    expect(packageJson.build.win).toMatchObject({
      publisherName: 'Haynie Minter',
      verifyUpdateCodeSignature: true,
    });
  });

  it.each(['darwin', 'win32'])('keeps %s updates user initiated', (platform) => {
    const updater = { autoDownload: true, autoInstallOnAppQuit: true };

    expect(configureUpdateSecurity(updater, platform)).toBe(updater);
    expect(updater).toMatchObject({ autoDownload: false, autoInstallOnAppQuit: false });
  });

  it('removes the Linux in-app update path', () => {
    const updater = { autoDownload: true, autoInstallOnAppQuit: true };

    expect(configureUpdateSecurity(updater, 'linux')).toBeNull();
    expect(updater).toMatchObject({ autoDownload: false, autoInstallOnAppQuit: false });
  });

  it('arms macOS staging only after user approval and can revoke it', () => {
    const updater = { autoInstallOnAppQuit: false };

    expect(allowInstallAfterUserApproval(updater, 'darwin')).toBe(true);
    expect(updater.autoInstallOnAppQuit).toBe(true);
    disableAutomaticUpdateInstall(updater);
    expect(updater.autoInstallOnAppQuit).toBe(false);
  });

  it('does not arm automatic installation on Windows', () => {
    const updater = { autoInstallOnAppQuit: false };

    expect(allowInstallAfterUserApproval(updater, 'win32')).toBe(false);
    expect(updater.autoInstallOnAppQuit).toBe(false);
  });
});

