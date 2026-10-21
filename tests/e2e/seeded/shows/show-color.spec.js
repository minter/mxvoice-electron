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

// The surfaces as computed with transitions off: the gutter (.container-fluid paints the
// window behind the panels), a panel card, a card header and the transport card
const surfaces = (page) =>
  page.evaluate(() => {
    const still = Object.assign(document.createElement('style'), { textContent: '* { transition: none !important; }' });
    document.head.append(still);
    const bg = (selector) => getComputedStyle(document.querySelector(selector)).backgroundColor;
    const out = {
      gutter: bg('.container-fluid'),
      card: bg('#hotkeys-column .card'),
      header: bg('#hotkeys-column .card-header'),
      searchHeader: bg('#search-column .card-header'),
      tabs: bg('#hotkey_tabs'),
      transport: bg('#player-panel')
    };
    still.remove();
    return out;
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
    const plain = await surfaces(page);
    const plainScroll = await page.evaluate(() => document.documentElement.scrollHeight);

    await clickShowMenu(app, 'Color', 'Teal');

    await expect(page.locator('html[data-show-color="teal"]')).toHaveCount(1);
    await expect.poll(() => activeShow(readShows(userDataDir, PROFILE)).color).toBe('teal');
    await expect.poll(async () => (await colorMenuState(app)).checked).toBe('Teal');
    // Only the gutter changes; panels, headers, tabs and the transport stay neutral
    const colored = await surfaces(page);
    expect(colored.gutter).not.toBe(plain.gutter);
    expect({ ...colored, gutter: null }).toEqual({ ...plain, gutter: null });
    // The color never changes the layout
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(plainScroll);
    // A color is a show property: the layout is untouched and nothing reads unsaved
    expect(activeShow(readShows(userDataDir, PROFILE)).layout.hotkeys[0].hotkeys.f1).toBe('1001');
    await expect(page.locator('#show-dirty')).toBeHidden();

    await quitAndRelaunch();
    await expect(page.locator('html[data-show-color="teal"]')).toHaveCount(1);
    await expect(page.locator('#show-name')).toHaveText('Main Show');
    expect((await colorMenuState(app)).checked).toBe('Teal');
  });

  test('every Color item shows a swatch: a filled circle, or a hollow ring for None', async () => {
    await launch([{ name: 'Main Show' }]);
    const icons = await app.evaluate(({ Menu }) => {
      const shows = Menu.getApplicationMenu()?.items.find((item) => item.label === 'Shows');
      const color = shows?.submenu?.items.find((item) => item.label === 'Color');
      return (color?.submenu?.items ?? []).map((item) => {
        const icon = item.icon;
        if (!icon || icon.isEmpty()) return { label: item.label, icon: null };
        // Center pixel of the 1x bitmap, BGRA
        const bitmap = icon.toBitmap({ scaleFactor: 1 });
        const i = (8 * 16 + 8) * 4;
        return {
          label: item.label,
          type: item.type,
          size: icon.getSize(),
          scaleFactors: icon.getScaleFactors(),
          center: [bitmap[i + 2], bitmap[i + 1], bitmap[i], bitmap[i + 3]]
        };
      });
    });
    expect(icons.map((i) => i.label)).toEqual(['None', 'Teal', 'Blue', 'Purple', 'Pink', 'Coral', 'Amber', 'Green']);
    for (const icon of icons) {
      expect(icon.type, icon.label).toBe('radio');
      expect(icon.size, icon.label).toEqual({ width: 16, height: 16 });
      expect(icon.scaleFactors, icon.label).toEqual(expect.arrayContaining([1, 2]));
    }
    expect(icons[0].center[3]).toBe(0);
    expect(icons.find((i) => i.label === 'Teal').center).toEqual([0x0f, 0x6e, 0x56, 255]);
  });

  test('switching to an uncolored show, None and Save As', async () => {
    await launch([{ name: 'Main Show' }, { name: 'Plain Show' }]);
    const plainGutter = (await surfaces(page)).gutter;
    await clickShowMenu(app, 'Color', 'Purple');
    await expect(page.locator('html[data-show-color="purple"]')).toHaveCount(1);
    expect((await surfaces(page)).gutter).not.toBe(plainGutter);

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
    expect((await surfaces(page)).gutter).toBe(plainGutter);
    expect(readShows(userDataDir, PROFILE).shows.find((b) => b.name === 'Main Show').color).toBe('purple');
  });

  test('panels stay unchanged and the pill stays readable on every color, in light and dark mode', async () => {
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
      const wrapper = document.querySelector('.container-fluid');
      const panelSelectors = ['#holding-tank-column .card', '#search-column .card', '#hotkeys-column .card',
        '#holding-tank-column .card-header', '#search-column .card-header', '#hotkeys-column .card-header',
        '#hotkey_tabs', '#holding_tank_tabs', '#player-panel'];
      const panels = () => panelSelectors.map((s) => getComputedStyle(document.querySelector(s)).backgroundColor).join('|');
      // Text drawn directly on the gutter: a non-blank text node whose nearest painted
      // ancestor is the wrapper itself, or the wrapper's panel rows (#top-row, #player-row)
      const bare = [];
      const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.nodeValue.trim()) continue;
        let el = node.parentElement;
        while (el && el !== wrapper) {
          if (getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)') break;
          el = el.parentElement;
        }
        if (el === wrapper && node.parentElement.offsetParent !== null) bare.push(node.parentElement.id || node.parentElement.tagName);
      }
      const original = body.className;
      const still = Object.assign(document.createElement('style'), { textContent: '* { transition: none !important; }' });
      document.head.append(still);
      const out = [];
      for (const mode of ['light', 'dark']) {
        // The window's mode is the body class theme-management sets
        body.classList.remove('theme-light', 'theme-dark');
        body.classList.add(`theme-${mode}`);
        delete html.dataset.showColor;
        const plainPanels = panels();
        const plainGutter = getComputedStyle(wrapper).backgroundColor;
        for (const key of palette) {
          html.dataset.showColor = key;
          const pill = getComputedStyle(showName);
          out.push({
            mode,
            key,
            gutterChanged: getComputedStyle(wrapper).backgroundColor !== plainGutter,
            panelsUnchanged: panels() === plainPanels,
            pillContrast: contrast(pill.color, pill.backgroundColor)
          });
        }
      }
      still.remove();
      body.className = original;
      delete html.dataset.showColor;
      return { out, bare };
    }, PALETTE);

    // Light tokens apply without any body.theme-* class
    const noClassBg = await page.evaluate(() => {
      const body = document.body;
      const original = body.className;
      document.documentElement.dataset.showColor = 'teal';
      body.classList.remove('theme-light', 'theme-dark');
      const value = getComputedStyle(body).getPropertyValue('--show-bg').trim();
      body.className = original;
      delete document.documentElement.dataset.showColor;
      return value;
    });
    expect(noClassBg.toUpperCase()).toBe('#5DCAA5');

    // Nothing is drawn directly on the gutter, so there is no text to keep readable
    expect(results.bare).toEqual([]);
    expect(results.out).toHaveLength(PALETTE.length * 2);
    for (const { mode, key, gutterChanged, panelsUnchanged, pillContrast } of results.out) {
      expect(gutterChanged, `${mode} ${key}: gutter colored`).toBe(true);
      expect(panelsUnchanged, `${mode} ${key}: panels unchanged`).toBe(true);
      expect(pillContrast, `${mode} ${key}: show-name pill`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
