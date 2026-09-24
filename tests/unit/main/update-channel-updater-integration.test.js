/**
 * Runs the installed electron-updater's real release selection (GitHubProvider)
 * and update decision (AppUpdater.isUpdateAvailable) against a simulated GitHub
 * release feed, with the app's configureUpdateChannel applied. Only the network
 * is stubbed.
 *
 * electron-updater's prerelease channel handling has changed between patch
 * versions (6.8.3 → 6.8.9), so this guards dependency bumps: if an upgrade
 * changes which release a tester is offered, this fails.
 */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { configureUpdateChannel } from '../../../src/main/modules/update-channel.js';

const require = createRequire(import.meta.url);
// AppUpdater requires electron at load time; only its prototype is used here
require.cache[require.resolve('electron')] = { exports: { app: {}, autoUpdater: {} } };

const updaterDir = path.dirname(require.resolve('electron-updater/package.json'));
const { AppUpdater } = require(path.join(updaterDir, 'out/AppUpdater.js'));
const { GitHubProvider } = require(path.join(updaterDir, 'out/providers/GitHubProvider.js'));
const { HttpError } = require(require.resolve('builder-util-runtime', { paths: [updaterDir] }));
// Must be the semver copy electron-updater uses; SemVer objects don't cross copies
const semver = require(require.resolve('semver', { paths: [updaterDir] }));

// Tags already on GitHub, newest first. Some tags have no release (orphans), as
// in the real feed: releases.atom lists tags, but only releases have files.
const EXISTING = [
  { tag: 'v4.3.2', release: true },
  { tag: 'v4.3.1', release: true },
  { tag: 'v4.3.0', release: false },
  { tag: 'v4.3.0-pre.3', release: false, prerelease: true },
  { tag: 'v4.3.0-pre.2', release: false, prerelease: true },
  { tag: 'v4.3.0-pre.1', release: false, prerelease: true },
  { tag: 'v4.2.1', release: true },
  { tag: 'v4.2.0', release: true },
  { tag: 'v4.2.0-pre.2', release: true, prerelease: true },
];

const HOP = { tag: 'v4.3.3-pre.1', release: true, prerelease: true };
const STABLE = { tag: 'v4.3.3', release: true };

function feedXml(entries) {
  const items = entries.map(({ tag }) =>
    `<entry><id>tag:github.com,2008:Repository/1/${tag}</id><updated>2026-10-01T00:00:00Z</updated>` +
    `<link rel="alternate" type="text/html" href="https://github.com/minter/mxvoice-electron/releases/tag/${tag}"/>` +
    `<title>${tag}</title><content type="html">notes</content></entry>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom">${items}</feed>`;
}

/**
 * Ask the real updater what it would offer.
 *
 * @param {Object} params
 * @param {string} params.currentVersion - Version the install is running
 * @param {boolean} params.prereleasePref - The prerelease_updates preference
 * @param {Array} params.published - Releases published after EXISTING, newest first
 * @param {'win32'|'darwin'} [params.platform]
 */
async function offeredUpdate({ currentVersion, prereleasePref, published = [], platform = 'win32' }) {
  const entries = [...published, ...EXISTING];
  const updater = Object.create(AppUpdater.prototype);
  Object.assign(updater, {
    _channel: null,
    allowPrerelease: false,
    allowDowngrade: false,
    fullChangelog: false,
    currentVersion: semver.parse(currentVersion),
    isUpdateSupported: () => true,
    isUserWithinRollout: () => true,
  });
  configureUpdateChannel(updater, { currentVersion, userPrefersPrereleases: prereleasePref });

  const requestedFiles = [];
  const executor = {
    // GitHub releases only ever carry latest*.yml, never beta.yml / pre.yml
    request: async ({ path: urlPath }) => {
      const [, tag, file] = urlPath.match(/download\/([^/]+)\/([^/?]+)/);
      requestedFiles.push(file);
      const hasFile = entries.find((e) => e.tag === tag)?.release && /^latest(-mac)?\.yml$/.test(file);
      if (!hasFile) throw new HttpError(404, 'Not Found');
      return `version: ${tag.slice(1)}\npath: app.exe\nsha512: abc\nreleaseDate: '2026-10-01'\nfiles:\n  - url: app.exe\n    sha512: abc\n    size: 1\n`;
    },
  };
  const provider = new GitHubProvider(
    { provider: 'github', owner: 'minter', repo: 'mxvoice-electron', channel: 'latest' },
    updater,
    { isUseMultipleRangeRequest: false, platform, executor }
  );
  provider.httpRequest = async (url) => {
    if (String(url).endsWith('/releases/latest')) {
      // GitHub's "latest release" skips prereleases and orphan tags
      const latest = entries.find((e) => e.release && !e.prerelease);
      return JSON.stringify({ tag_name: latest.tag });
    }
    return feedXml(entries);
  };

  const info = await provider.getLatestVersion();
  const available = await updater.isUpdateAvailable(info);
  return { version: available ? info.version : null, picked: info.tag, requestedFiles };
}

describe.each(['win32', 'darwin'])('electron-updater with configureUpdateChannel (%s)', (platform) => {
  it('keeps downgrades off even though the real channel setter enables them', () => {
    const updater = Object.create(AppUpdater.prototype);
    Object.assign(updater, { _channel: null, allowDowngrade: false });
    configureUpdateChannel(updater, { currentVersion: '4.3.3-pre.1', userPrefersPrereleases: true });

    expect(updater.channel).toBe('beta');
    expect(updater.allowDowngrade).toBe(false);
  });

  it('offers a -pre install the next stable release (the stranded-tester bug)', async () => {
    const result = await offeredUpdate({
      currentVersion: '4.3.3-pre.1', prereleasePref: false, published: [STABLE, HOP], platform,
    });
    expect(result.version).toBe('4.3.3');
  });

  it('does not downgrade a -pre install to an older stable release', async () => {
    const result = await offeredUpdate({ currentVersion: '4.3.3-pre.1', prereleasePref: false, published: [HOP], platform });
    expect(result.picked).toBe('v4.3.2');
    expect(result.version).toBeNull();
  });

  it('offers a beta to a stable install that opted into prereleases', async () => {
    const result = await offeredUpdate({
      currentVersion: '4.3.3', prereleasePref: true, published: [{ tag: 'v4.4.0-beta.1', release: true, prerelease: true }, STABLE, HOP], platform,
    });
    expect(result.version).toBe('4.4.0-beta.1');
    // No beta.yml exists on GitHub releases; the updater must fall back to latest
    expect(result.requestedFiles).toEqual(platform === 'darwin' ? ['beta-mac.yml', 'latest-mac.yml'] : ['beta.yml', 'latest.yml']);
  });

  it('does not offer a beta to a stable install that has not opted in', async () => {
    const result = await offeredUpdate({
      currentVersion: '4.3.3', prereleasePref: false, published: [{ tag: 'v4.4.0-beta.1', release: true, prerelease: true }, STABLE, HOP], platform,
    });
    expect(result.version).toBeNull();
  });

  it('offers a beta tester the next beta and then the final stable release', async () => {
    const beta1 = { tag: 'v4.4.0-beta.1', release: true, prerelease: true };
    const nextBeta = await offeredUpdate({
      currentVersion: '4.4.0-beta.1', prereleasePref: true,
      published: [{ tag: 'v4.4.0-beta.2', release: true, prerelease: true }, beta1, STABLE, HOP], platform,
    });
    const finalStable = await offeredUpdate({
      currentVersion: '4.4.0-beta.1', prereleasePref: true,
      published: [{ tag: 'v4.4.0', release: true }, beta1, STABLE, HOP], platform,
    });

    expect(nextBeta.version).toBe('4.4.0-beta.2');
    expect(finalStable.version).toBe('4.4.0');
  });

  it('never offers -pre releases on the beta channel (prereleases must be -beta.N)', async () => {
    const result = await offeredUpdate({
      currentVersion: '4.3.3', prereleasePref: true,
      published: [{ tag: 'v4.4.0-pre.1', release: true, prerelease: true }, STABLE, HOP], platform,
    });
    expect(result.picked).toBe('v4.3.3');
    expect(result.version).toBeNull();
  });
});
