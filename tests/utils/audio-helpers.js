/**
 * Audio testing helpers for Playwright E2E tests
 */

/**
 * Get current RMS value from audio probe
 * @param {Page} page - Playwright page object
 * @returns {Promise<number>} Current RMS value
 */
export async function rms(page) {
  return page.evaluate(() => {
    const get = window.electronTest?.getAudioProbe || (() => window.electronTest?.audioProbe ?? null);
    return get()?.currentRMS?.() ?? 0;
  });
}

/**
 * Wait for audio to become silent
 * @param {Page} page - Playwright page object
 * @param {number} threshold - Silence threshold (default: 1e-3)
 * @param {number} timeout - Timeout in ms (default: 5000)
 * @returns {Promise<void>}
 */
export async function waitForSilence(page, threshold = 1e-3, timeout = 5000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const currentRMS = await rms(page);
    if (currentRMS < threshold) {
      return;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`Audio did not become silent within ${timeout}ms`);
}

/**
 * Wait for audio to become audible
 * @param {Page} page - Playwright page object
 * @param {number} threshold - Audible threshold (default: 3e-3)
 * @param {number} timeout - Timeout in ms (default: 5000)
 * @returns {Promise<void>}
 */
export async function waitForAudible(page, threshold = 3e-3, timeout = 5000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const currentRMS = await rms(page);
    if (currentRMS > threshold) {
      return;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`Audio did not become audible within ${timeout}ms`);
}

/**
 * Stabilize audio measurements
 * @param {Page} page - Playwright page object
 * @param {number} ms - Milliseconds to wait (default: 120)
 * @returns {Promise<void>}
 */
export async function stabilize(page, ms = 120) {
  await page.waitForTimeout(ms);
}

/**
 * Start test oscillator
 * @param {Page} page - Playwright page object
 * @returns {Promise<void>}
 */
export async function startTestOscillator(page) {
  await page.evaluate(() => {
    if (window.electronTest?.testOscillator) {
      window.electronTest.testOscillator.start();
    }
  });
}

/**
 * Stop test oscillator
 * @param {Page} page - Playwright page object
 * @returns {Promise<void>}
 */
export async function stopTestOscillator(page) {
  await page.evaluate(() => {
    if (window.electronTest?.testOscillator) {
      window.electronTest.testOscillator.stop();
    }
  });
}
