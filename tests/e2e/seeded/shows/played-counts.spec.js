import { _electron as electron, test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { launchSeededApp, waitForAppReady } from '../../../utils/seeded-launch.js';
import { crashApp, relaunchApp, waitForShowSettled } from '../../../utils/relaunch.js';
import { seedShows } from '../../../utils/seed-shows.js';
import { SHOW_IDS, clickShowMenu, quitApp, waitForShowMenuReady } from '../../../utils/show-e2e.js';

// Seeded songs: 1001 Got The Time, 1002 The Wheel, 1003, 1004 We Are Family (0:07), 1005 Eat It (0:06).
const PROFILE = 'Default User';
const EAT_IT = '1005';
const FAMILY = '1004';

/** Main Show: Eat It on F1 and in the holding tank; Second Show: We Are Family on F2. */
function twoShows() {
  const now = Date.now();
  const show = (index, name, hotkeys, songIds) => ({
    id: SHOW_IDS[index],
    name,
    createdAt: now + index,
    updatedAt: now + index,
    layout: {
      hotkeys: [{ tabNumber: 1, tabName: null, hotkeys }],
      holdingTank: [{ tabNumber: 1, tabName: null, songIds }],
      selected: { hotkeyTab: 1, holdingTankTab: 1 }
    }
  });
  return {
    version: 1,
    activeShowId: SHOW_IDS[0],
    shows: [
      show(0, 'Main Show', { f1: EAT_IT }, [EAT_IT, FAMILY]),
      show(1, 'Second Show', { f2: FAMILY }, [])
    ]
  };
}

const playedPath = (userDataDir) => path.join(userDataDir, 'recovery', 'default user.played.json');
function readPlayed(userDataDir) {
  try {
    return JSON.parse(fs.readFileSync(playedPath(userDataDir), 'utf8'));
  } catch {
    return null;
  }
}

// The pill draws its count from data-count; it never carries a songid
const hotkeyPill = (page, key) => page.locator(`#hotkeys_list_1 li:nth-child(${key}) > .played-pill`);
const tankPill = (page, songId) => page.locator(`#holding_tank_1 li[songid="${songId}"] > .played-pill`);
const searchRow = (page, songId) => page.locator(`#search_results tbody tr[songid="${songId}"]`);
const searchPill = (page, songId) => searchRow(page, songId).locator('td:nth-child(3) > .played-pill');

async function search(page, term) {
  const input = page.locator('#omni_search');
  await input.fill(term);
  await input.press('Enter');
}

async function resetPlayedEnabled(app) {
  return app.evaluate(({ Menu }) => {
    const shows = Menu.getApplicationMenu()?.items.find((item) => item.label === 'Shows');
    return shows?.submenu?.items.find((item) => item.label === 'Reset Played')?.enabled ?? null;
  });
}

async function stop(page) {
  await page.locator('#stop_button').click();
  await expect(page.locator('#play_button')).toBeVisible({ timeout: 10000 });
}

function restorePrompt(page) {
  return page.locator('.modal.show').filter({ hasText: 'Restore show?' });
}

test.describe('Shows - played counts', () => {
  let app;
  let page;
  let userDataDir;
  let suiteRoot;
  const homes = [];

  async function launch() {
    ({ app, page, userDataDir, suiteRoot } = await launchSeededApp(electron, 'played-counts', {
      beforeLaunch: (dir) => seedShows(dir, PROFILE, twoShows())
    }));
    await waitForAppReady(page, app);
    await waitForShowMenuReady(app);
  }

  async function relaunch() {
    let fakeHome;
    ({ app, page, fakeHome } = await relaunchApp(electron, userDataDir, { profile: PROFILE }));
    homes.push(fakeHome);
  }

  /** Play Eat It from search and wait until it is playing. */
  async function playEatItFromSearch() {
    await search(page, 'Eat It');
    await expect(searchRow(page, EAT_IT)).toHaveCount(1, { timeout: 10000 });
    await searchRow(page, EAT_IT).dblclick();
    await expect(page.locator('#song_now_playing')).toHaveAttribute('songid', EAT_IT, { timeout: 10000 });
  }

  test.afterEach(async () => {
    await app?.close().catch(() => {});
    app = null;
    for (const home of homes.splice(0)) fs.rmSync(home, { recursive: true, force: true });
    if (suiteRoot) fs.rmSync(suiteRoot, { recursive: true, force: true });
  });

  test('a play shows ▶ n wherever the song appears; unplay, show switch and Reset Played', async () => {
    await launch();
    await expect(page.locator('.played-pill')).toHaveCount(0);
    expect(await resetPlayedEnabled(app)).toBe(false);

    // Counted when playback starts: the pills are there while it still plays
    await playEatItFromSearch();
    await expect(searchPill(page, EAT_IT)).toHaveAttribute('data-count', '1', { timeout: 3000 });
    await expect(hotkeyPill(page, 1)).toHaveAttribute('data-count', '1');
    await expect(tankPill(page, EAT_IT)).toHaveAttribute('data-count', '1');
    await expect(page.locator('#pause_button')).toBeVisible();
    await expect(searchPill(page, EAT_IT)).toBeVisible();
    // The pill adds no text and no songid
    await expect(searchRow(page, EAT_IT).locator('td:nth-child(3)')).toHaveText('Eat It');
    await expect(page.locator('.played-pill[songid]')).toHaveCount(0);
    await expect.poll(() => resetPlayedEnabled(app)).toBe(true);
    await expect.poll(() => readPlayed(userDataDir)?.counts).toEqual({ [EAT_IT]: 1 });

    // Played again
    await searchRow(page, EAT_IT).dblclick();
    await expect(searchPill(page, EAT_IT)).toHaveAttribute('data-count', '2', { timeout: 3000 });
    await expect(hotkeyPill(page, 1)).toHaveAttribute('data-count', '2');
    await expect(tankPill(page, EAT_IT)).toHaveAttribute('data-count', '2');
    await stop(page);
    // Finishing or stopping doesn't count
    await expect(searchPill(page, EAT_IT)).toHaveAttribute('data-count', '2');

    // From the holding tank
    await page.locator(`#holding_tank_1 li[songid="${FAMILY}"]`).dblclick();
    await expect(tankPill(page, FAMILY)).toHaveAttribute('data-count', '1', { timeout: 5000 });
    await stop(page);
    await expect.poll(() => readPlayed(userDataDir)?.counts).toEqual({ [EAT_IT]: 2, [FAMILY]: 1 });

    // Mark as Unplayed on a hotkey slot clears that song everywhere
    const menu = page.locator('#mxv-context-menu');
    const unplayed = menu.getByRole('button', { name: 'Mark as Unplayed' });
    await page.locator('#hotkeys_list_1 li:nth-child(1)').click({ button: 'right' });
    await unplayed.click();
    await expect(hotkeyPill(page, 1)).toHaveCount(0);
    await expect(tankPill(page, EAT_IT)).toHaveCount(0);
    await expect(searchPill(page, EAT_IT)).toHaveCount(0);
    await expect(tankPill(page, FAMILY)).toHaveAttribute('data-count', '1');
    await expect.poll(() => readPlayed(userDataDir)?.counts).toEqual({ [FAMILY]: 1 });

    // It is offered only for a played song: not for Eat It now, still for We Are Family
    await page.locator('#hotkeys_list_1 li:nth-child(1)').click({ button: 'right' });
    await expect(menu).toBeVisible();
    await expect(unplayed).toBeHidden();
    await page.keyboard.press('Escape');
    await searchRow(page, EAT_IT).click({ button: 'right' });
    await expect(menu).toBeVisible();
    await expect(unplayed).toBeHidden();
    await page.keyboard.press('Escape');
    await page.locator(`#holding_tank_1 li[songid="${FAMILY}"]`).click({ button: 'right' });
    await expect(unplayed).toBeVisible();
    await page.keyboard.press('Escape');

    // A show switch keeps the counts: We Are Family is on F2 in the other show
    await clickShowMenu(app, 'Second Show');
    await expect(page.locator('#show-name')).toHaveText('Second Show');
    await expect(page.locator('#hotkeys_list_1 li:nth-child(2)')).toHaveAttribute('songid', FAMILY);
    await expect(hotkeyPill(page, 2)).toHaveAttribute('data-count', '1');
    expect(await resetPlayedEnabled(app)).toBe(true);

    // Reset Played clears them all, without asking
    await clickShowMenu(app, 'Reset Played');
    await expect(page.locator('.played-pill')).toHaveCount(0);
    await expect(page.locator('.modal.show')).toHaveCount(0);
    await expect.poll(() => resetPlayedEnabled(app)).toBe(false);
    await expect.poll(() => fs.existsSync(playedPath(userDataDir))).toBe(false);
  });

  test('a kill with counts and no layout change asks; Restore keeps them, Open saved show clears them', async () => {
    await launch();
    await playEatItFromSearch();
    await expect(hotkeyPill(page, 1)).toHaveAttribute('data-count', '1', { timeout: 3000 });
    await stop(page);
    await expect.poll(() => readPlayed(userDataDir)?.counts).toEqual({ [EAT_IT]: 1 });

    await crashApp(app);
    await relaunch();
    let prompt = restorePrompt(page);
    await expect(prompt).toBeVisible({ timeout: 20000 });
    await prompt.getByRole('button', { name: 'Restore show in progress' }).click();
    await waitForAppReady(page, app);
    await expect(hotkeyPill(page, 1)).toHaveAttribute('data-count', '1');
    await expect(tankPill(page, EAT_IT)).toHaveAttribute('data-count', '1');
    await expect.poll(() => resetPlayedEnabled(app)).toBe(true);
    // The saved show is on screen: nothing unsaved
    await expect(page.locator('#show-name')).toHaveText('Main Show');

    await crashApp(app);
    await relaunch();
    prompt = restorePrompt(page);
    await expect(prompt).toBeVisible({ timeout: 20000 });
    await prompt.getByRole('button', { name: 'Open saved show' }).click();
    await waitForAppReady(page, app);
    await expect(page.locator('#hotkeys_list_1 li:nth-child(1)')).toHaveAttribute('songid', EAT_IT);
    await expect(page.locator('.played-pill')).toHaveCount(0);
    await expect.poll(() => fs.existsSync(playedPath(userDataDir))).toBe(false);
  });

  test('a clean quit and relaunch starts with no counts', async () => {
    await launch();
    await playEatItFromSearch();
    await expect(hotkeyPill(page, 1)).toHaveAttribute('data-count', '1', { timeout: 3000 });
    await stop(page);
    await expect.poll(() => readPlayed(userDataDir)?.counts).toEqual({ [EAT_IT]: 1 });

    await quitApp(app);
    expect(fs.existsSync(playedPath(userDataDir))).toBe(false);
    await relaunch();
    await waitForShowSettled(page);
    await expect(restorePrompt(page)).toHaveCount(0);
    await waitForAppReady(page, app);
    await expect(page.locator('#hotkeys_list_1 li:nth-child(1)')).toHaveAttribute('songid', EAT_IT);
    await expect(page.locator('.played-pill')).toHaveCount(0);
  });
});
