import { expect } from '@playwright/test';

/**
 * Helpers for driving the Board menu and its dialogs in E2E.
 * Menu items are clicked from main, as native-menu-wiring.spec.js does.
 */

// Board ids must look like UUIDs: the board IPC handlers reject anything else
export const BOARD_IDS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003'
];

/** A boards document; `boards` is [{ name, hotkeys }], the first is active unless `active` says otherwise. */
export function multiBoardDocument(boards, { active = 0 } = {}) {
  const now = Date.now();
  const docBoards = boards.map(({ name, hotkeys = {} }, index) => ({
    id: BOARD_IDS[index],
    name,
    createdAt: now + index,
    updatedAt: now + index,
    layout: {
      hotkeys: [{ tabNumber: 1, tabName: null, hotkeys }],
      holdingTank: [{ tabNumber: 1, tabName: null, songIds: [] }],
      selected: { hotkeyTab: 1, holdingTankTab: 1 }
    }
  }));
  return { version: 1, activeBoardId: docBoards[active].id, boards: docBoards };
}

/**
 * Click Board > ...labels from main. Retries while the item is missing or
 * disabled, since the menu is rebuilt once a board finishes loading.
 */
export async function clickBoardMenu(app, ...labels) {
  await expect(async () => {
    const result = await app.evaluate(({ Menu, BrowserWindow }, path) => {
      let items = Menu.getApplicationMenu()?.items;
      let item = null;
      for (const label of path) {
        item = items?.find((candidate) => candidate.label === label) ?? null;
        if (!item) return { ok: false, reason: `Menu item not found: ${label}` };
        items = item.submenu?.items;
      }
      if (item.enabled === false) return { ok: false, reason: `Menu item disabled: ${path.at(-1)}` };
      const win = BrowserWindow.getAllWindows()[0];
      item.click({}, win, win.webContents);
      return { ok: true };
    }, ['Board', ...labels]);
    expect(result).toEqual({ ok: true });
  }).toPass({ timeout: 10000 });
}

/** The labels of the board radio items, and which one is checked. */
export async function boardMenuState(app) {
  return app.evaluate(({ Menu }) => {
    const board = Menu.getApplicationMenu()?.items.find((item) => item.label === 'Board');
    const radios = (board?.submenu?.items ?? []).filter((item) => item.type === 'radio');
    return {
      boards: radios.map((item) => item.label),
      checked: radios.find((item) => item.checked)?.label ?? null,
      enabled: radios.every((item) => item.enabled !== false)
    };
  });
}

export function shownDialog(page, title) {
  return page.locator('.modal.show').filter({ has: page.locator('.modal-title', { hasText: title }) });
}

/** Answer a customConfirm dialog titled `title` with the button `button`. */
export async function answerConfirm(page, title, button, { message } = {}) {
  const dialog = shownDialog(page, title);
  await expect(dialog).toBeVisible({ timeout: 10000 });
  if (message) await expect(dialog.locator('.modal-body')).toHaveText(message);
  const shown = await dialog.elementHandle();
  await dialog.getByRole('button', { name: button, exact: true }).click();
  await shown.waitForElementState('hidden');
}

/** Type into a customPrompt dialog titled `title` and press OK. */
export async function answerPrompt(page, title, value, { message } = {}) {
  const dialog = shownDialog(page, title);
  await expect(dialog).toBeVisible({ timeout: 10000 });
  if (message) await expect(dialog.locator('.modal-body p')).toHaveText(message);
  await dialog.locator('.prompt-input').fill(value);
  // This dialog, not any re-prompt that replaces it with the same title
  const shown = await dialog.elementHandle();
  await dialog.getByRole('button', { name: 'OK', exact: true }).click();
  await shown.waitForElementState('hidden');
}

export const f1Hotkey = (page) => page.locator('#hotkeys_list_1 #f1_hotkey');

// As a drop onto F1 does: assign, then request the (debounced) save
export async function assignF1(page, songId) {
  await page.evaluate(async (id) => {
    const f1 = document.querySelector('#hotkeys_list_1 #f1_hotkey');
    await window.moduleRegistry.hotkeys.setLabelFromSongId(id, f1);
    void window.moduleRegistry.hotkeys.requestProfileStateSave();
  }, songId);
  await expect(f1Hotkey(page)).toHaveAttribute('songid', songId);
}

export async function quitApp(app) {
  const exited = app.waitForEvent('close', { timeout: 20000 });
  await app.evaluate(({ app: electronApp }) => electronApp.quit());
  await exited;
}

/** Wait until the board session is ready (the menu radios are enabled). */
export async function waitForBoardMenuReady(app) {
  await expect.poll(async () => (await boardMenuState(app)).enabled, { timeout: 20000 }).toBe(true);
}
