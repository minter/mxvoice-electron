import { describe, expect, it } from 'vitest';
import { configureUpdateChannel, isPrereleaseVersion } from '../../../src/main/modules/update-channel.js';

// Mirrors electron-updater's AppUpdater: setting `channel` also enables downgrades
function fakeUpdater() {
  return {
    allowPrerelease: false,
    allowDowngrade: false,
    _channel: null,
    get channel() { return this._channel; },
    set channel(value) { this._channel = value; this.allowDowngrade = true; },
  };
}

describe('isPrereleaseVersion', () => {
  it.each([
    ['4.3.0-pre.3', true],
    ['4.4.0-beta.1', true],
    ['4.4.0-alpha.2', true],
    ['4.3.2', false],
    ['4.3.2-dev', false],
  ])('%s → %s', (version, expected) => {
    expect(isPrereleaseVersion(version)).toBe(expected);
  });
});

describe('configureUpdateChannel', () => {
  it('uses the beta channel when the user opts into prereleases on a stable build', () => {
    const updater = fakeUpdater();
    const result = configureUpdateChannel(updater, { currentVersion: '4.3.2', userPrefersPrereleases: true });

    expect(result).toEqual({ allowPrerelease: true, isCurrentlyPrerelease: false });
    expect(updater.allowPrerelease).toBe(true);
    expect(updater.channel).toBe('beta');
  });

  it('moves -pre builds onto the beta channel so they also receive stable releases', () => {
    const updater = fakeUpdater();
    configureUpdateChannel(updater, { currentVersion: '4.3.3-pre.1', userPrefersPrereleases: false });

    expect(updater.allowPrerelease).toBe(true);
    expect(updater.channel).toBe('beta');
  });

  it('uses the latest channel without prereleases', () => {
    const updater = fakeUpdater();
    const result = configureUpdateChannel(updater, { currentVersion: '4.3.2', userPrefersPrereleases: false });

    expect(result).toEqual({ allowPrerelease: false, isCurrentlyPrerelease: false });
    expect(updater.allowPrerelease).toBe(false);
    expect(updater.channel).toBe('latest');
  });

  it('never allows downgrades, despite the channel setter enabling them', () => {
    const updater = fakeUpdater();
    configureUpdateChannel(updater, { currentVersion: '4.3.3-pre.1', userPrefersPrereleases: true });

    expect(updater.allowDowngrade).toBe(false);
  });

  it('can be re-applied when the preference changes', () => {
    const updater = fakeUpdater();
    configureUpdateChannel(updater, { currentVersion: '4.3.2', userPrefersPrereleases: true });
    configureUpdateChannel(updater, { currentVersion: '4.3.2', userPrefersPrereleases: false });

    expect(updater.channel).toBe('latest');
    expect(updater.allowPrerelease).toBe(false);
    expect(updater.allowDowngrade).toBe(false);
  });
});
