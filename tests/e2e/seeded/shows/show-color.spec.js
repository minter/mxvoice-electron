import { _electron as electron, test, expect } from '@playwright/test';
import fs from 'fs';
import { launchSeededApp, waitForAppReady } from '../../../utils/seeded-launch.js';
import { relaunchApp, waitForShowSettled } from '../../../utils/relaunch.js';
import { readShows, seedShows } from '../../../utils/seed-shows.js';
import {
  answerPrompt,
  clickShowMenu,
  multiShowDocument,
  quitApp,
  showMenuState,
  waitForShowMenuReady
} from '../../../utils/show-e2e.js';

const PROFILE = 'Default User';
const PALETTE = ['teal', 'blue', 'purple', 'pink', 'coral', 'amber', 'green'];

const activeShow = (doc) => doc.shows.find((b) => b.id === doc.activeShowId);
const showColorAttr = (page) => page.evaluate(() => document.documentElement.dataset.showColor ?? null);

/** The checked item of Shows > Color, and whether the submenu is enabled. */
function colorMenuState(app) {
  return app.evaluate(({ Menu }) => {
    const shows = Menu.getApplicationMenu()?.items.find((item) => item.label === 'Shows');
    const color = shows?.submenu?.items.find((item) => item.label === 'Color');
    const items = color?.submenu?.items ?? [];
    return {
      labels: items.map((item) => item.label),
      checked: items.find((item) => item.checked)?.label ?? null,
      enabled: color?.enabled !== false
    };
  });
}

// Headers animate color changes; cancel that so the computed color is the end state
const headerBackground = (page) =>
  page.evaluate(() => {
    const header = document.querySelector('#hotkeys-column .card-header');
    header.style.transition = 'none';
    const color = getComputedStyle(header).backgroundColor;
    header.style.removeProperty('transition');
    return color;
  });

test.describe('Shows - show color', () => {
  let app;
  let page;
  let userDataDir;
  let suiteRoot;
  const homes = [];

  async function launch(shows) {
    ({ app, page, userDataDir, suiteRoot } = await launchSeededApp(electron, 'show-color', {
      beforeLaunch: (dir) => seedShows(dir, PROFILE, multiShowDocument(shows))
    }));
    await waitForAppReady(page, app);
    await waitForShowMenuReady(app);
  }

  async function quitAndRelaunch() {
    await quitApp(app);
    let fakeHome;
    ({ app, page, fakeHome } = await relaunchApp(electron, userDataDir, { profile: PROFILE }));
    homes.push(fakeHome);
    await waitForShowSettled(page);
    await waitForAppReady(page, app);
    await waitForShowMenuReady(app);
  }

  test.afterEach(async () => {
    await app?.close().catch(() => {});
    app = null;
    for (const home of homes.splice(0)) fs.rmSync(home, { recursive: true, force: true });
    if (suiteRoot) fs.rmSync(suiteRoot, { recursive: true, force: true });
  });

  test('Teal from the menu colors the window, saves at once and survives a quit', async () => {
    await launch([{ name: 'Main Show', hotkeys: { f1: '1001' } }]);
    expect(await showColorAttr(page)).toBeNull();
    expect(await colorMenuState(app)).toEqual({
      labels: ['None', 'Teal', 'Blue', 'Purple', 'Pink', 'Coral', 'Amber', 'Green'],
      checked: 'None',
      enabled: true
    });
    const plainHeader = await headerBackground(page);
    const plainScroll = await page.evaluate(() => document.documentElement.scrollHeight);

    await clickShowMenu(app, 'Color', 'Teal');

    await expect(page.locator('html[data-show-color="teal"]')).toHaveCount(1);
    await expect.poll(() => activeShow(readShows(userDataDir, PROFILE)).color).toBe('teal');
    await expect.poll(async () => (await colorMenuState(app)).checked).toBe('Teal');
    expect(await headerBackground(page)).not.toBe(plainHeader);
    // The band never changes the layout
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(plainScroll);
    // A color is a show property: the layout is untouched and nothing reads unsaved
    expect(activeShow(readShows(userDataDir, PROFILE)).layout.hotkeys[0].hotkeys.f1).toBe('1001');
    await expect(page.locator('#show-dirty')).toBeHidden();

    await quitAndRelaunch();
    await expect(page.locator('html[data-show-color="teal"]')).toHaveCount(1);
    await expect(page.locator('#show-name')).toHaveText('Main Show');
    expect((await colorMenuState(app)).checked).toBe('Teal');
  });

  test('switching to an uncolored show, None and Save As', async () => {
    await launch([{ name: 'Main Show' }, { name: 'Plain Show' }]);
    await clickShowMenu(app, 'Color', 'Purple');
    await expect(page.locator('html[data-show-color="purple"]')).toHaveCount(1);

    // An uncolored show takes the color away; switching back brings it back
    await clickShowMenu(app, 'Plain Show');
    await expect(page.locator('#show-name')).toHaveText('Plain Show');
    await expect.poll(() => showColorAttr(page)).toBeNull();
    await expect.poll(async () => (await colorMenuState(app)).checked).toBe('None');
    await waitForShowMenuReady(app);
    await clickShowMenu(app, 'Main Show');
    await expect(page.locator('html[data-show-color="purple"]')).toHaveCount(1);
    await waitForShowMenuReady(app);

    // Save As copies the color to the new show
    await clickShowMenu(app, 'Save As…');
    await answerPrompt(page, 'Save As', 'Late Show', { message: 'Name for the new show' });
    await expect(page.locator('#show-name')).toHaveText('Late Show');
    await expect.poll(() => activeShow(readShows(userDataDir, PROFILE))).toMatchObject({ name: 'Late Show', color: 'purple' });
    await expect(page.locator('html[data-show-color="purple"]')).toHaveCount(1);
    await expect.poll(async () => (await showMenuState(app)).checked).toBe('Late Show');

    // None removes it, from the window and the saved show
    await clickShowMenu(app, 'Color', 'None');
    await expect.poll(() => showColorAttr(page)).toBeNull();
    await expect.poll(() => activeShow(readShows(userDataDir, PROFILE)).color).toBeNull();
    expect(readShows(userDataDir, PROFILE).shows.find((b) => b.name === 'Main Show').color).toBe('purple');
  });

  test('header text and the show-name pill stay readable on every color, in light and dark mode', async () => {
    await launch([{ name: 'Main Show' }]);
    const results = await page.evaluate((palette) => {
      // Computed colors come back as rgb(), color(srgb …) or oklab(); a canvas reads any of them
      const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 })
        .getContext('2d', { willReadFrequently: true });
      const parse = (value) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = '#000';
        ctx.fillStyle = value;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, alpha] = ctx.getImageData(0, 0, 1, 1).data;
        if (alpha !== 255) throw new Error(`Not an opaque color: ${value}`);
        return [r, g, b];
      };
      const luminance = ([r, g, b]) => {
        const [R, G, B] = [r, g, b].map((c) => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * R + 0.7152 * G + 0.0722 * B;
      };
      const contrast = (a, b) => {
        const [hi, lo] = [luminance(parse(a)), luminance(parse(b))].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
      };
      const html = document.documentElement;
      const body = document.body;
      const showName = document.getElementById('show-name');
      const headers = ['#holding-tank-column', '#search-column', '#hotkeys-column']
        .map((column) => document.querySelector(`${column} .card-header`));
      const original = body.className;
      // Headers animate color changes; measure end states
      const still = Object.assign(document.createElement('style'), { textContent: '* { transition: none !important; }' });
      document.head.append(still);
      const out = [];
      for (const mode of ['light', 'dark']) {
        // The window's mode is the body class theme-management sets
        body.classList.remove('theme-light', 'theme-dark');
        body.classList.add(`theme-${mode}`);
        delete html.dataset.showColor;
        const plain = getComputedStyle(headers[2]).backgroundColor;
        for (const key of palette) {
          html.dataset.showColor = key;
          const headerContrast = Math.min(...headers.map((h) => {
            const style = getComputedStyle(h);
            return contrast(style.color, style.backgroundColor);
          }));
          const pill = getComputedStyle(showName);
          out.push({
            mode,
            key,
            tinted: getComputedStyle(headers[2]).backgroundColor !== plain,
            headerContrast,
            pillContrast: contrast(pill.color, pill.backgroundColor)
          });
        }
      }
      still.remove();
      body.className = original;
      delete html.dataset.showColor;
      return out;
    }, PALETTE);

    // Light tokens apply without any body.theme-* class; the band paints above the headers
    const extras = await page.evaluate(() => {
      const body = document.body;
      const original = body.className;
      document.documentElement.dataset.showColor = 'teal';
      body.classList.remove('theme-light', 'theme-dark');
      const band = getComputedStyle(body, '::before');
      const out = {
        noClassBand: getComputedStyle(body).getPropertyValue('--show-band').trim(),
        bandZ: Number(band.zIndex),
        bandPosition: band.position,
        headerZ: getComputedStyle(document.querySelector('#hotkeys-column .card-header')).zIndex
      };
      body.className = original;
      delete document.documentElement.dataset.showColor;
      return out;
    });
    expect(extras.noClassBand.toUpperCase()).toBe('#0F6E56');
    expect(extras).toMatchObject({ bandZ: 1001, bandPosition: 'fixed', headerZ: 'auto' });

    expect(results).toHaveLength(PALETTE.length * 2);
    for (const { mode, key, tinted, headerContrast, pillContrast } of results) {
      expect(tinted, `${mode} ${key}: header tinted`).toBe(true);
      expect(headerContrast, `${mode} ${key}: header text`).toBeGreaterThanOrEqual(4.5);
      expect(pillContrast, `${mode} ${key}: show-name pill`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
